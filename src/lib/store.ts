/**
 * FlowQA Store — extracted state from FlowQAShell.
 *
 * Plain TypeScript class. No React dependency.
 * Emits to SignalBus on key state changes.
 */

import type {
  Flow,
  Issue,
  IssueType,
  MountFlowQAOptions,
  Step,
  StrategicObservation,
  FlowBundle,
  GitContextFile,
  RouteConfig,
  StepCorrection,
} from "./types";
import { loadWorkspace, type LoadedWorkspace } from "./loader";
import {
  assumptionsForFlows,
  changedRoutes,
  flowsCoveringChangedRoutes,
  staleStepIds,
  strategicGaps,
  changedFileGroups,
  type ChangedFileGroup,
} from "./git-map";
import { findMatchingStepIds } from "./match-url";
import {
  getCorrections,
  getFacadeMode,
  getIssues,
  getStepNotes,
  getVisitedSteps,
  idbPut,
  idbGet,
  setCorrections,
  setFacadeMode as persistFacadeMode,
  setIssues,
  setStepNotes,
  setVisitedSteps,
  type FacadeMode,
} from "./storage";
import { exportJson, exportMarkdown, buildSessionPrompt } from "./export-report";
import {
  computeStrategyState,
  type StrategyState,
} from "./strategy-inference";
import { clusterRelatedIssues } from "./dedupe";
import {
  applyCopyPatches,
  restoreCopyPatches,
  setFacadeModeOnApp,
  type CopyPatch,
} from "./dom-facade";
import {
  loadSessionState,
  saveSessionState,
  startOrResumeSession,
  recordStepPresence,
  checkSessionComplete,
  type SessionState,
  type FlowSession,
} from "./session-tracker";
import { getSignalBus } from "./signal-bus";

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `fq-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ─── Issue Draft Type ─────────────────────────────────────────────────── */

export interface IssueDraft {
  notes: string;
  type: IssueType;
  strategic_note: string;
  severity: Issue["severity"] | "";
  evidence_direction: Issue["evidence_direction"] | "";
  componentName: string;
  selector: string;
  patternBreadth: string;
}

const EMPTY_ISSUE_DRAFT: IssueDraft = {
  notes: "",
  type: "bug",
  strategic_note: "",
  severity: "",
  evidence_direction: "",
  componentName: "",
  selector: "",
  patternBreadth: "",
};

/* ─── Store Options ────────────────────────────────────────────────────── */

export interface FlowQAStoreOptions {
  routeConfig: RouteConfig;
  getLocation: () => { pathname: string; search: string };
  enabled?: boolean;
  subscribeLocation?: (cb: () => void) => () => void;
  flowQaAssetBase?: string;
  gitContextPath?: string;
  /** Ref to the app viewport DOM element — set after mount */
  getAppViewportEl: () => HTMLElement | null;
}

/* ─── Listener ─────────────────────────────────────────────────────────── */

type StoreListener = () => void;

/* ─── Store ────────────────────────────────────────────────────────────── */

export class FlowQAStore {
  // ── Config ──
  private opts: FlowQAStoreOptions;
  private bus = getSignalBus();

  // ── Primary State ──
  open = false;
  workspace: LoadedWorkspace | null = null;
  pathname = "";
  viewport: string = "full";
  activeFlowId: string | null = null;
  copied = false;
  visited: Record<string, number> = {};
  notes: Record<string, string> = {};
  issues: Issue[] = [];
  facadeMode: FacadeMode = "off";
  copySelector = "";
  copyText = "";
  copyPatches: CopyPatch[] = [];
  sessionState: SessionState = { activeSession: null, history: [] };
  issueDraft: IssueDraft = { ...EMPTY_ISSUE_DRAFT };
  selectedSegment: string | null = null;
  dismissedProvocationIds: Set<string> = new Set(
    JSON.parse(localStorage.getItem("fq-dismissed-provocations") || "[]")
  );

  // ── Subscriptions ──
  private listeners = new Set<StoreListener>();
  private disposed = false;
  private cleanupFns: (() => void)[] = [];
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;
  private dwellTimer: ReturnType<typeof setInterval> | null = null;
  private locationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: FlowQAStoreOptions) {
    this.opts = opts;
    this.pathname = opts.getLocation().pathname;
    this.visited = getVisitedSteps();
    this.notes = getStepNotes();
    this.issues = getIssues();
    this.facadeMode = getFacadeMode();
    this.sessionState = loadSessionState();

    if (opts.enabled !== false) {
      this.init();
    }
  }

  /* ─── Subscription API ─────────────────────────────────────────────── */

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error("[FlowQAStore] listener error:", err);
      }
    }
  }

  /* ─── Initialization ───────────────────────────────────────────────── */

  private async init() {
    const { flowQaAssetBase = "/flow-qa", gitContextPath = "git-context.json" } = this.opts;
    const ws = await loadWorkspace(flowQaAssetBase, {
      gitFile: gitContextPath.replace(/^\//, ""),
    });
    if (this.disposed) return;
    this.workspace = ws;
    // Auto-mark visited steps for current page
    this.autoMarkVisited();
    this.notify();

    // Set up location tracking
    this.setupLocationTracking();
    // Set up keyboard shortcut
    this.setupKeyboardShortcut();
    // Set up window toggle
    this.setupWindowToggle();
  }

  private setupLocationTracking() {
    const { getLocation, subscribeLocation } = this.opts;
    if (subscribeLocation) {
      const unsub = subscribeLocation(() => {
        const next = getLocation().pathname;
        if (next !== this.pathname) {
          this.pathname = next;
          this.autoMarkVisited();
          this.notify();
        }
      });
      this.cleanupFns.push(unsub);
    } else {
      this.locationTimer = setInterval(() => {
        const next = getLocation().pathname;
        if (next !== this.pathname) {
          this.pathname = next;
          this.autoMarkVisited();
          this.notify();
        }
      }, 400);
      this.cleanupFns.push(() => {
        if (this.locationTimer) clearInterval(this.locationTimer);
      });
    }
  }

  private setupKeyboardShortcut() {
    const matchesToggle = (e: KeyboardEvent): boolean => {
      if (e.metaKey || e.repeat) return false;
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyF") return true;
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "Backquote") return true;
      if (e.ctrlKey && e.altKey && !e.shiftKey && e.code === "KeyF") return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!matchesToggle(e)) return;
      e.preventDefault();
      e.stopPropagation();
      this.setOpen(!this.open);
    };
    window.addEventListener("keydown", onKey, true);
    this.cleanupFns.push(() => window.removeEventListener("keydown", onKey, true));
  }

  private setupWindowToggle() {
    if (typeof window === "undefined") return;
    (window as any).__FLOW_QA_TOGGLE__ = () => this.setOpen(!this.open);
    console.info(
      "[Flow QA] Toggle: Control+Shift+F (or Control+Shift+`, or Control+Option+F) — or run __FLOW_QA_TOGGLE__() in the console — or use the corner button."
    );
    this.cleanupFns.push(() => {
      delete (window as any).__FLOW_QA_TOGGLE__;
    });
  }

  /* ─── Derived State (getters) ──────────────────────────────────────── */

  get bundle(): FlowBundle | null {
    return this.workspace?.bundle ?? null;
  }

  get gitCtx(): GitContextFile | null {
    return this.workspace?.gitContext ?? null;
  }

  get observations(): StrategicObservation[] {
    return this.workspace?.observations ?? [];
  }

  get changed() {
    return this.gitCtx ? changedRoutes(this.gitCtx, this.opts.routeConfig) : [];
  }

  get hotFlows(): Flow[] {
    return this.bundle ? flowsCoveringChangedRoutes(this.bundle, this.changed) : [];
  }

  get hotAssumptions(): string[] {
    return assumptionsForFlows(this.hotFlows);
  }

  get segments(): string[] {
    if (!this.bundle) return [];
    const s = new Set<string>();
    for (const f of this.bundle.flows) if (f.segment?.trim()) s.add(f.segment.trim());
    return [...s].sort();
  }

  get stale(): Set<string> {
    return this.bundle
      ? staleStepIds(this.bundle, this.visited, this.gitCtx, this.opts.routeConfig)
      : new Set<string>();
  }

  get gaps() {
    return this.bundle ? strategicGaps(this.bundle) : null;
  }

  get changeGroups(): ChangedFileGroup[] {
    return this.bundle
      ? changedFileGroups(this.gitCtx, this.opts.routeConfig, this.bundle)
      : [];
  }

  get strategyState(): StrategyState | null {
    if (!this.bundle) return null;
    return computeStrategyState({
      bundle: this.bundle,
      issues: this.issues,
      observations: this.observations,
      visited: this.visited,
      stale: this.stale,
    });
  }

  get activeFlow(): Flow | null {
    return this.bundle?.flows.find((f) => f.id === this.activeFlowId) ?? null;
  }

  get matchingStepIds(): string[] {
    if (!this.bundle) return [];
    return findMatchingStepIds(this.pathname, this.bundle.steps);
  }

  get issueTypeCounts(): Record<IssueType, number> {
    const c: Record<IssueType, number> = {
      bug: 0,
      ux_friction: 0,
      strategic_gap: 0,
      assumption_evidence: 0,
    };
    for (const i of this.issues) c[i.type] += 1;
    return c;
  }

  get relatedGroups(): string[][] {
    const flowStepRoute = (flowId: string, stepId: string) => {
      return this.bundle?.steps[stepId]?.urlPattern;
    };
    return clusterRelatedIssues(this.issues, flowStepRoute);
  }

  get currentStepForIssue(): Step | null {
    if (!this.bundle || !this.activeFlow) return null;
    const sid =
      this.matchingStepIds.find((id) => this.activeFlow!.steps.includes(id)) ??
      this.activeFlow.steps[0] ??
      null;
    return sid ? this.bundle.steps[sid] ?? null : null;
  }

  get displayFlow(): Flow | null {
    if (this.activeFlow) return this.activeFlow;
    // suggestedFlow logic
    if (!this.bundle) return null;
    const segFlows = this.selectedSegment
      ? this.bundle.flows.filter((f) => f.segment === this.selectedSegment)
      : this.bundle.flows;
    const flowsHere = segFlows.filter((f) =>
      f.steps.some((sid) => this.matchingStepIds.includes(sid))
    );
    const flowHasStaleSteps = (f: Flow) => f.steps.some((sid) => this.stale.has(sid));
    return (
      flowsHere.find((f) => flowHasStaleSteps(f)) ??
      flowsHere.find((f) => this.hotFlows.some((h) => h.id === f.id)) ??
      flowsHere[0] ??
      segFlows.find((f) => flowHasStaleSteps(f)) ??
      this.hotFlows.find((f) => !this.selectedSegment || f.segment === this.selectedSegment) ??
      null
    );
  }

  get flowSession(): FlowSession | null {
    return this.sessionState.activeSession;
  }

  get sessionHistory(): FlowSession[] {
    return this.sessionState.history;
  }

  /* ─── Actions ──────────────────────────────────────────────────────── */

  setOpen(v: boolean) {
    if (this.open === v) return;
    this.open = v;

    // Session resume: auto-select flow from persisted session on open
    if (v && !this.activeFlowId) {
      const saved = loadSessionState();
      if (saved.activeSession && !saved.activeSession.completed) {
        this.activeFlowId = saved.activeSession.flowId;
      }
    }

    // Manage dwell timer
    this.manageDwellTimer();
    this.notify();
  }

  setActiveFlowId(id: string | null) {
    if (this.activeFlowId === id) return;
    this.activeFlowId = id;
    this.bus.emit("flow-selected", id);

    // Start/resume session
    if (id) {
      this.sessionState = startOrResumeSession(this.sessionState, id);
      saveSessionState(this.sessionState);
    }

    this.notify();
  }

  setViewport(v: string) {
    if (this.viewport === v) return;
    this.viewport = v;
    this.notify();
  }

  setSelectedSegment(s: string | null) {
    if (this.selectedSegment === s) return;
    this.selectedSegment = s;
    this.notify();
  }

  setIssueDraft(updater: IssueDraft | ((prev: IssueDraft) => IssueDraft)) {
    if (typeof updater === "function") {
      this.issueDraft = updater(this.issueDraft);
    } else {
      this.issueDraft = updater;
    }
    this.notify();
  }

  setCopySelector(s: string) {
    this.copySelector = s;
    this.notify();
  }

  setCopyText(s: string) {
    this.copyText = s;
    this.notify();
  }

  onSaveStepNote(stepId: string, text: string) {
    this.notes = { ...this.notes, [stepId]: text };
    setStepNotes(this.notes);
    this.notify();
  }

  onToggleVisited(stepId: string) {
    const next = { ...this.visited };
    if (next[stepId]) {
      delete next[stepId];
    } else {
      next[stepId] = Date.now();
    }
    this.visited = next;
    setVisitedSteps(next);
    this.checkSessionCompletion();
    this.notify();
  }

  async onLogIssue() {
    if (!this.bundle || !this.activeFlow) return;
    const af = this.activeFlow;
    const stepId =
      this.matchingStepIds.find((id) => af.steps.includes(id)) ??
      af.steps[0] ??
      null;
    if (!stepId) return;

    const screenshot = await this.captureScreenshotKey();
    const pb = this.issueDraft.patternBreadth
      ? Number(this.issueDraft.patternBreadth)
      : undefined;
    const issue: Issue = {
      id: newId(),
      flowId: af.id,
      stepId,
      notes: this.issueDraft.notes,
      screenshot,
      componentName: this.issueDraft.componentName || undefined,
      selector: this.issueDraft.selector || undefined,
      patternBreadth: Number.isFinite(pb) ? pb : undefined,
      timestamp: Date.now(),
      type: this.issueDraft.type,
      strategic_note: this.issueDraft.strategic_note || undefined,
      severity: this.issueDraft.severity || undefined,
      evidence_direction: this.issueDraft.evidence_direction || undefined,
    };
    this.issues = [...this.issues, issue];
    setIssues(this.issues);
    this.issueDraft = { ...EMPTY_ISSUE_DRAFT };
    this.notify();
  }

  async onExportMd() {
    if (!this.bundle) return;
    const md = await exportMarkdown({
      bundle: this.bundle,
      issues: this.issues,
      observations: this.observations,
      getScreenshotBlob: (k) => idbGet(k),
    });
    await navigator.clipboard.writeText(md);
    alert("Markdown export copied to clipboard");
  }

  async onExportJson() {
    if (!this.bundle) return;
    const js = await exportJson({
      bundle: this.bundle,
      issues: this.issues,
      observations: this.observations,
      getScreenshotBlob: (k) => idbGet(k),
    });
    await navigator.clipboard.writeText(js);
    alert("JSON export copied to clipboard");
  }

  onCopySession() {
    if (!this.bundle) return;
    const prompt = buildSessionPrompt({
      bundle: this.bundle,
      issues: this.issues,
      observations: this.observations,
      notes: this.notes,
      visited: this.visited,
      changeGroups: this.changeGroups,
    });
    navigator.clipboard.writeText(prompt).then(() => {
      this.copied = true;
      this.notify();
      this.bus.emit("prompt-ready", prompt);
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copied = false;
        this.notify();
      }, 2000);
    });
  }

  onRecordCorrection() {
    if (!this.activeFlow || !this.bundle) return;
    const af = this.activeFlow;
    const stepId =
      this.matchingStepIds.find((id) => af.steps.includes(id)) ?? af.steps[0];
    if (!stepId) return;
    const cur = getCorrections();
    const next: StepCorrection[] = [
      ...cur,
      {
        flowId: af.id,
        stepId,
        matchedPathname: this.pathname,
        matchedSelector: this.bundle.steps[stepId]?.selector,
        recordedAt: Date.now(),
      },
    ];
    setCorrections(next);
    alert("Recorded ground truth for this step (saved locally).");
  }

  onApplyFacadeMode(m: FacadeMode) {
    this.facadeMode = m;
    persistFacadeMode(m);
    const el = this.opts.getAppViewportEl();
    setFacadeModeOnApp(el, m === "empty_state" ? "empty_state" : "off");
    if (m !== "copy_review") {
      restoreCopyPatches(el, this.copyPatches);
      this.copyPatches = [];
    }
    this.notify();
  }

  onApplyCopy() {
    if (!this.copySelector.trim()) return;
    const patch: CopyPatch = { selector: this.copySelector.trim(), text: this.copyText };
    this.copyPatches = [...this.copyPatches, patch];
    applyCopyPatches(this.opts.getAppViewportEl(), [patch]);
    this.facadeMode = "copy_review";
    persistFacadeMode("copy_review");
    this.notify();
  }

  /* ─── Provocations ──────────────────────────────────────────────── */

  dismissProvocation(id: string) {
    this.dismissedProvocationIds.add(id);
    try {
      localStorage.setItem(
        "fq-dismissed-provocations",
        JSON.stringify([...this.dismissedProvocationIds])
      );
    } catch {}
    this.notify();
  }

  /* ─── Enabled toggling ─────────────────────────────────────────────── */

  setEnabled(enabled: boolean) {
    if (!enabled) {
      this.open = false;
      this.workspace = null;
      this.stopDwellTimer();
      this.notify();
    } else if (!this.workspace) {
      this.init();
    }
  }

  /* ─── Internal helpers ─────────────────────────────────────────────── */

  private autoMarkVisited() {
    if (!this.bundle) return;
    const matching = this.matchingStepIds;
    let changed = false;
    const next = { ...this.visited };
    const now = Date.now();
    for (const sid of matching) {
      if (!next[sid]) {
        changed = true;
        next[sid] = now;
      }
    }
    if (changed) {
      this.visited = next;
      setVisitedSteps(next);
      this.checkSessionCompletion();
    }
  }

  private checkSessionCompletion() {
    if (!this.sessionState.activeSession) return;
    const flowId = this.sessionState.activeSession.flowId;
    const flow = this.bundle?.flows.find((f) => f.id === flowId);
    if (!flow) return;
    const session = checkSessionComplete(this.sessionState.activeSession, flow.steps, this.visited);
    if (session === this.sessionState.activeSession) return;
    this.sessionState = { ...this.sessionState, activeSession: session };
    saveSessionState(this.sessionState);
  }

  private manageDwellTimer() {
    this.stopDwellTimer();
    if (this.open) {
      this.dwellTimer = setInterval(() => {
        if (!this.sessionState.activeSession) return;
        let session = this.sessionState.activeSession;
        for (const sid of this.matchingStepIds) {
          session = recordStepPresence(session, sid, 1000);
        }
        this.sessionState = { ...this.sessionState, activeSession: session };
        saveSessionState(this.sessionState);
        this.notify();
      }, 1000);
    }
  }

  private stopDwellTimer() {
    if (this.dwellTimer) {
      clearInterval(this.dwellTimer);
      this.dwellTimer = null;
    }
  }

  private async captureScreenshotKey(): Promise<string> {
    const el = this.opts.getAppViewportEl();
    if (!el) return "";
    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(el, { cacheBust: true, pixelRatio: 1 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const key = `ss-${newId()}`;
      await idbPut(key, blob);
      return key;
    } catch {
      return "";
    }
  }

  /** Apply facade mode to DOM — call when appViewportRef becomes available or facade changes */
  applyFacadeToDOM() {
    const el = this.opts.getAppViewportEl();
    setFacadeModeOnApp(el, this.facadeMode === "empty_state" ? "empty_state" : "off");
    if (this.facadeMode !== "copy_review") {
      restoreCopyPatches(el, this.copyPatches);
    }
  }

  /* ─── Cleanup ──────────────────────────────────────────────────────── */

  dispose() {
    this.disposed = true;
    this.stopDwellTimer();
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    if (this.locationTimer) clearInterval(this.locationTimer);
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.listeners.clear();
  }
}

/* ─── Factory ──────────────────────────────────────────────────────────── */

export function createFlowQAStore(opts: FlowQAStoreOptions): FlowQAStore {
  return new FlowQAStore(opts);
}
