import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as htmlToImage from "html-to-image";
import type { Flow, Issue, IssueType, MountFlowQAOptions, Step } from "../lib/types";
import { loadWorkspace, type LoadedWorkspace } from "../lib/loader";
import {
  assumptionsForFlows,
  changedRoutes,
  flowsCoveringChangedRoutes,
  staleStepIds,
  strategicGaps,
  changedFileGroups,
  type ChangedFileGroup,
} from "../lib/git-map";
import { findMatchingStepIds } from "../lib/match-url";
import {
  getCorrections,
  getFacadeMode,
  getIssues,
  getStepNotes,
  getVisitedSteps,
  idbPut,
  idbGet,
  setCorrections,
  setFacadeMode,
  setIssues,
  setStepNotes,
  setVisitedSteps,
  type FacadeMode,
} from "../lib/storage";
import { exportJson, exportMarkdown, buildSessionPrompt } from "../lib/export-report";
import {
  computeStrategyState,
  type StrategyState,
  type AssumptionHealth,
  type StrategySignal,
} from "../lib/strategy-inference";
import { clusterRelatedIssues } from "../lib/dedupe";
import {
  applyCopyPatches,
  restoreCopyPatches,
  setFacadeModeOnApp,
  type CopyPatch,
} from "../lib/dom-facade";
import { SIDEBAR_CSS } from "./sidebar-styles";
import {
  loadSessionState,
  saveSessionState,
  startOrResumeSession,
  recordStepPresence,
  checkSessionComplete,
  dwellLabel,
  sessionStats,
  type SessionState,
  type FlowSession,
} from "../lib/session-tracker";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `fq-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const VIEWPORT_WIDTH: Record<string, string | undefined> = {
  "375": "375px",
  "414": "414px",
  "768": "768px",
  full: undefined,
};

export interface FlowQAShellProps extends MountFlowQAOptions {
  children: React.ReactNode;
  appViewportRef: React.RefObject<HTMLDivElement | null>;
}

export function FlowQAShell(props: FlowQAShellProps) {
  const {
    children,
    appViewportRef,
    routeConfig,
    getLocation,
    enabled = true,
    subscribeLocation,
    flowQaAssetBase = "/flow-qa",
    gitContextPath = "git-context.json",
  } = props;

  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState<LoadedWorkspace | null>(null);
  const [pathname, setPathname] = useState(() => getLocation().pathname);
  const [viewport, setViewport] = useState<keyof typeof VIEWPORT_WIDTH>("full");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [visited, setVisited] = useState<Record<string, number>>(getVisitedSteps);
  const [notes, setNotes] = useState<Record<string, string>>(getStepNotes);
  const [issues, setIssuesState] = useState<Issue[]>(getIssues);
  const [facadeMode, setFacadeModeState] = useState<FacadeMode>(getFacadeMode);
  const [copySelector, setCopySelector] = useState("");
  const [copyText, setCopyText] = useState("");
  const [copyPatches, setCopyPatches] = useState<CopyPatch[]>([]);

  const [sessionState, setSessionState] = useState<SessionState>(loadSessionState);

  const [issueDraft, setIssueDraft] = useState({
    notes: "",
    type: "bug" as IssueType,
    strategic_note: "",
    severity: "" as Issue["severity"] | "",
    evidence_direction: "" as Issue["evidence_direction"] | "",
    componentName: "",
    selector: "",
    patternBreadth: "" as string,
  });

  useEffect(() => {
    if (!enabled) {
      setWorkspace(null);
      return;
    }
    loadWorkspace(flowQaAssetBase, { gitFile: gitContextPath.replace(/^\//, "") }).then(setWorkspace);
  }, [enabled, flowQaAssetBase, gitContextPath]);

  useEffect(() => {
    if (!enabled) return;
    if (!subscribeLocation) {
      const t = setInterval(() => setPathname(getLocation().pathname), 400);
      return () => clearInterval(t);
    }
    const unsub = subscribeLocation(() => setPathname(getLocation().pathname));
    return unsub;
  }, [enabled, getLocation, subscribeLocation]);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const matchesToggle = (e: KeyboardEvent): boolean => {
      if (e.metaKey || e.repeat) return false;
      // Primary: Control+Shift+F (F = Flow QA). Use Control, not Command on Mac.
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyF") return true;
      // Alternate: Control+Shift+` (US Backquote); UK/EU may use different physical keys.
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "Backquote") return true;
      // Fallback: Control+Alt+F (no Shift) — avoids Shift+dead-key issues on some layouts.
      if (e.ctrlKey && e.altKey && !e.shiftKey && e.code === "KeyF") return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!matchesToggle(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      if (typeof window !== "undefined") {
        delete (window as unknown as { __FLOW_QA_TOGGLE__?: () => void }).__FLOW_QA_TOGGLE__;
      }
      return;
    }
    if (typeof window === "undefined") return;
    (window as unknown as { __FLOW_QA_TOGGLE__?: () => void }).__FLOW_QA_TOGGLE__ = () =>
      setOpen((o) => !o);
    console.info(
      "[Flow QA] Toggle: Control+Shift+F (or Control+Shift+`, or Control+Option+F) — or run __FLOW_QA_TOGGLE__() in the console — or use the corner button."
    );
    return () => {
      delete (window as unknown as { __FLOW_QA_TOGGLE__?: () => void }).__FLOW_QA_TOGGLE__;
    };
  }, [enabled]);

  const bundle = workspace?.bundle ?? null;
  const gitCtx = workspace?.gitContext ?? null;
  const observations = workspace?.observations ?? [];

  const changed = useMemo(
    () => (gitCtx ? changedRoutes(gitCtx, routeConfig) : []),
    [gitCtx, routeConfig]
  );
  const hotFlows = useMemo(
    () => (bundle ? flowsCoveringChangedRoutes(bundle, changed) : []),
    [bundle, changed]
  );
  const hotAssumptions = useMemo(() => assumptionsForFlows(hotFlows), [hotFlows]);

  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const segments = useMemo(() => {
    if (!bundle) return [];
    const s = new Set<string>();
    for (const f of bundle.flows) if (f.segment?.trim()) s.add(f.segment.trim());
    return [...s].sort();
  }, [bundle]);

  const stale = useMemo(
    () => (bundle ? staleStepIds(bundle, visited, gitCtx, routeConfig) : new Set<string>()),
    [bundle, visited, gitCtx, routeConfig]
  );

  const gaps = useMemo(
    () => (bundle ? strategicGaps(bundle) : null),
    [bundle]
  );

  const changeGroups = useMemo(
    () => (bundle ? changedFileGroups(gitCtx, routeConfig, bundle) : []),
    [gitCtx, routeConfig, bundle]
  );

  const strategyState = useMemo(
    () =>
      bundle
        ? computeStrategyState({ bundle, issues, observations, visited, stale })
        : null,
    [bundle, issues, observations, visited, stale]
  );

  const activeFlow = bundle?.flows.find((f) => f.id === activeFlowId) ?? null;

  const matchingStepIds = useMemo(() => {
    if (!bundle) return [];
    return findMatchingStepIds(pathname, bundle.steps);
  }, [bundle, pathname]);

  useEffect(() => {
    if (!enabled || !bundle) return;
    setVisited((prev) => {
      let next = prev;
      let changed = false;
      const now = Date.now();
      for (const sid of matchingStepIds) {
        if (!next[sid]) {
          if (!changed) next = { ...prev };
          changed = true;
          next[sid] = now;
        }
      }
      if (changed) setVisitedSteps(next);
      return changed ? next : prev;
    });
  }, [enabled, bundle, matchingStepIds]);

  // Session tracking: start/resume when activeFlowId changes
  useEffect(() => {
    if (!enabled || !activeFlowId) return;
    setSessionState((prev) => {
      const next = startOrResumeSession(prev, activeFlowId);
      saveSessionState(next);
      return next;
    });
  }, [enabled, activeFlowId]);

  // Session tracking: dwell tick every 1s for steps on the current page
  useEffect(() => {
    if (!enabled || !open) return;
    const TICK_MS = 1000;
    const t = setInterval(() => {
      setSessionState((prev) => {
        if (!prev.activeSession) return prev;
        let session = prev.activeSession;
        for (const sid of matchingStepIds) {
          session = recordStepPresence(session, sid, TICK_MS);
        }
        const next = { ...prev, activeSession: session };
        saveSessionState(next);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [enabled, open, matchingStepIds]);

  // Session resume: auto-select flow from persisted session on open
  useEffect(() => {
    if (!enabled || !open || activeFlowId) return;
    const saved = loadSessionState();
    if (saved.activeSession && !saved.activeSession.completed) {
      setActiveFlowId(saved.activeSession.flowId);
    }
  }, [enabled, open]); // intentionally exclude activeFlowId to only run on open

  // Session tracking: check completion when visited changes
  useEffect(() => {
    if (!enabled) return;
    setSessionState((prev) => {
      if (!prev.activeSession) return prev;
      const flowId = prev.activeSession.flowId;
      const flow = workspace?.bundle?.flows.find((f) => f.id === flowId);
      if (!flow) return prev;
      const session = checkSessionComplete(prev.activeSession, flow.steps, visited);
      if (session === prev.activeSession) return prev;
      const next = { ...prev, activeSession: session };
      saveSessionState(next);
      return next;
    });
  }, [enabled, visited, workspace]);

  useEffect(() => {
    if (!enabled) return;
    setFacadeModeOnApp(appViewportRef.current, facadeMode === "empty_state" ? "empty_state" : "off");
    if (facadeMode !== "copy_review") {
      restoreCopyPatches(appViewportRef.current, copyPatches);
    }
  }, [enabled, facadeMode, appViewportRef, copyPatches]);

  const flowStepRoute = useCallback(
    (flowId: string, stepId: string) => {
      const st = bundle?.steps[stepId];
      return st?.urlPattern;
    },
    [bundle]
  );

  const relatedGroups = useMemo(
    () => clusterRelatedIssues(issues, flowStepRoute),
    [issues, flowStepRoute]
  );

  const issueTypeCounts = useMemo(() => {
    const c: Record<IssueType, number> = {
      bug: 0,
      ux_friction: 0,
      strategic_gap: 0,
      assumption_evidence: 0,
    };
    for (const i of issues) c[i.type] += 1;
    return c;
  }, [issues]);

  const onSaveStepNote = (stepId: string, text: string) => {
    const next = { ...notes, [stepId]: text };
    setNotes(next);
    setStepNotes(next);
  };

  const onToggleVisited = useCallback((stepId: string) => {
    setVisited((prev) => {
      const next = { ...prev };
      if (next[stepId]) {
        delete next[stepId];
      } else {
        next[stepId] = Date.now();
      }
      setVisitedSteps(next);
      return next;
    });
  }, []);

  const captureScreenshotKey = async (): Promise<string> => {
    const el = appViewportRef.current;
    if (!el) return "";
    const dataUrl = await htmlToImage.toPng(el, { cacheBust: true, pixelRatio: 1 });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const key = `ss-${newId()}`;
    await idbPut(key, blob);
    return key;
  };

  const onLogIssue = async () => {
    if (!bundle || !activeFlow) return;
    const stepId =
      matchingStepIds.find((id) => activeFlow.steps.includes(id)) ??
      activeFlow.steps[0] ??
      null;
    if (!stepId) return;
    const screenshot = await captureScreenshotKey();
    const step = bundle.steps[stepId];
    const pb = issueDraft.patternBreadth ? Number(issueDraft.patternBreadth) : undefined;
    const issue: Issue = {
      id: newId(),
      flowId: activeFlow.id,
      stepId,
      notes: issueDraft.notes,
      screenshot,
      componentName: issueDraft.componentName || undefined,
      selector: issueDraft.selector || undefined,
      patternBreadth: Number.isFinite(pb) ? pb : undefined,
      timestamp: Date.now(),
      type: issueDraft.type,
      strategic_note: issueDraft.strategic_note || undefined,
      severity: issueDraft.severity || undefined,
      evidence_direction: issueDraft.evidence_direction || undefined,
    };
    const next = [...issues, issue];
    setIssuesState(next);
    setIssues(next);
    setIssueDraft({
      notes: "",
      type: "bug",
      strategic_note: "",
      severity: "",
      evidence_direction: "",
      componentName: "",
      selector: "",
      patternBreadth: "",
    });
  };

  const currentStepForIssue = useMemo(() => {
    if (!bundle || !activeFlow) return null;
    const sid =
      matchingStepIds.find((id) => activeFlow.steps.includes(id)) ?? activeFlow.steps[0] ?? null;
    return sid ? bundle.steps[sid] ?? null : null;
  }, [bundle, activeFlow, matchingStepIds]);

  const onExportMd = async () => {
    if (!bundle) return;
    const md = await exportMarkdown({
      bundle,
      issues,
      observations,
      getScreenshotBlob: (k) => idbGet(k),
    });
    await navigator.clipboard.writeText(md);
    alert("Markdown export copied to clipboard");
  };

  const onExportJson = async () => {
    if (!bundle) return;
    const js = await exportJson({
      bundle,
      issues,
      observations,
      getScreenshotBlob: (k) => idbGet(k),
    });
    await navigator.clipboard.writeText(js);
    alert("JSON export copied to clipboard");
  };

  const onCopySession = useCallback(() => {
    if (!bundle) return;
    const prompt = buildSessionPrompt({
      bundle,
      issues,
      observations,
      notes,
      visited,
      changeGroups,
    });
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [bundle, issues, observations, notes, visited, changeGroups]);

  const onRecordCorrection = () => {
    if (!activeFlow || !bundle) return;
    const stepId =
      matchingStepIds.find((id) => activeFlow.steps.includes(id)) ?? activeFlow.steps[0];
    if (!stepId) return;
    const cur = getCorrections();
    const next = [
      ...cur,
      {
        flowId: activeFlow.id,
        stepId,
        matchedPathname: pathname,
        matchedSelector: bundle.steps[stepId]?.selector,
        recordedAt: Date.now(),
      },
    ];
    setCorrections(next);
    alert("Recorded ground truth for this step (saved locally).");
  };

  const onApplyFacadeMode = (m: FacadeMode) => {
    setFacadeModeState(m);
    setFacadeMode(m);
    if (m !== "copy_review") {
      restoreCopyPatches(appViewportRef.current, copyPatches);
      setCopyPatches([]);
    }
  };

  const onApplyCopy = () => {
    if (!copySelector.trim()) return;
    const patch: CopyPatch = { selector: copySelector.trim(), text: copyText };
    const next = [...copyPatches, patch];
    setCopyPatches(next);
    applyCopyPatches(appViewportRef.current, [patch]);
    setFacadeModeState("copy_review");
    setFacadeMode("copy_review");
  };

  const width = VIEWPORT_WIDTH[viewport];

  const sidebarHostRef = useRef<HTMLDivElement>(null);
  const sidebarRootRef = useRef<Root | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !open) {
      sidebarRootRef.current?.render(<div style={{ display: "none" }} />);
      return;
    }
    const host = sidebarHostRef.current;
    if (!host) return;

    if (!host.shadowRoot) {
      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = SIDEBAR_CSS;
      shadow.appendChild(style);
      const mount = document.createElement("div");
      mount.setAttribute("data-flow-qa-react-root", "1");
      mount.style.cssText = "height:100%;min-height:0;min-width:0;display:flex;flex-direction:column";
      // Prevent host app keyboard shortcuts from stealing keystrokes in form fields
      shadow.addEventListener("keydown", (e: Event) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) {
          e.stopPropagation();
        }
      });
      shadow.appendChild(mount);
      sidebarRootRef.current = createRoot(mount);
    } else if (!sidebarRootRef.current) {
      const mount = host.shadowRoot.querySelector("[data-flow-qa-react-root]");
      if (mount) sidebarRootRef.current = createRoot(mount);
    }

    sidebarRootRef.current?.render(
      <SidebarInner
        changed={changed}
        hotFlows={hotFlows}
        hotAssumptions={hotAssumptions}
        observations={observations}
        bundle={bundle}
        pathname={pathname}
        matchingStepIds={matchingStepIds}
        stale={stale}
        gaps={gaps}
        segments={segments}
        selectedSegment={selectedSegment}
        setSelectedSegment={setSelectedSegment}
        issues={issues}
        issueTypeCounts={issueTypeCounts}
        relatedGroups={relatedGroups}
        activeFlow={activeFlow}
        activeFlowId={activeFlowId}
        setActiveFlowId={setActiveFlowId}
        visited={visited}
        notes={notes}
        onSaveStepNote={onSaveStepNote}
        onToggleVisited={onToggleVisited}
        viewport={viewport}
        setViewport={setViewport}
        issueDraft={issueDraft}
        setIssueDraft={setIssueDraft}
        onLogIssue={onLogIssue}
        onExportMd={onExportMd}
        onExportJson={onExportJson}
        currentStepForIssue={currentStepForIssue}
        facadeMode={facadeMode}
        onApplyFacadeMode={onApplyFacadeMode}
        copySelector={copySelector}
        setCopySelector={setCopySelector}
        copyText={copyText}
        setCopyText={setCopyText}
        onApplyCopy={onApplyCopy}
        onRecordCorrection={onRecordCorrection}
        changeGroups={changeGroups}
        strategyState={strategyState}
        flowSession={sessionState.activeSession}
        sessionHistory={sessionState.history}
        onCopySession={onCopySession}
        copied={copied}
      />
    );
  }, [
    enabled,
    open,
    changed,
    hotFlows,
    hotAssumptions,
    observations,
    bundle,
    pathname,
    matchingStepIds,
    stale,
    gaps,
    segments,
    selectedSegment,
    issues,
    issueTypeCounts,
    relatedGroups,
    activeFlow,
    activeFlowId,
    visited,
    notes,
    viewport,
    issueDraft,
    facadeMode,
    copySelector,
    copyText,
    currentStepForIssue,
    onSaveStepNote,
    onLogIssue,
    onExportMd,
    onExportJson,
    onApplyFacadeMode,
    onApplyCopy,
    onRecordCorrection,
    changeGroups,
    strategyState,
    sessionState,
    onCopySession,
    copied,
  ]);

  if (!enabled) {
    return (
      <div
        ref={appViewportRef}
        data-flow-qa-app-inner
        data-flow-qa-disabled="1"
        style={{ minHeight: "100vh" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "100vh" }}>
      <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0 }}>
        <div
          ref={appViewportRef}
          data-flow-qa-app-inner
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "auto",
            width: width ?? "100%",
            maxWidth: width ?? "100%",
            margin: width ? "0 auto" : undefined,
            transition: "max-width 0.2s ease",
          }}
        >
          {children}
        </div>
        {open && (
          <div
            ref={sidebarHostRef}
            style={{
              width: 380,
              maxWidth: "42vw",
              minWidth: 300,
              borderLeft: "1px solid #2d333b",
              background: "#0f1419",
            }}
          />
        )}
      </div>
      {!open && (
        <button
          type="button"
          style={{
            position: "fixed",
            bottom: 12,
            right: 12,
            zIndex: 2147483000,
            opacity: 0.85,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #30363d",
            background: "#21262d",
            color: "#e6edf3",
            fontSize: 12,
            cursor: "pointer",
          }}
          onClick={() => setOpen(true)}
        >
          Flow QA (Ctrl+Shift+F)
        </button>
      )}
    </div>
  );
}

/* ─── SidebarInner ─────────────────────────────────────────────────────────── */

function SidebarInner(props: {
  changed: import("../lib/types").RouteConfig["routes"];
  hotFlows: Flow[];
  hotAssumptions: string[];
  observations: import("../lib/types").StrategicObservation[];
  bundle: LoadedWorkspace["bundle"] | null;
  pathname: string;
  matchingStepIds: string[];
  stale: Set<string>;
  gaps: ReturnType<typeof strategicGaps> | null;
  segments: string[];
  selectedSegment: string | null;
  setSelectedSegment: (s: string | null) => void;
  issues: Issue[];
  issueTypeCounts: Record<IssueType, number>;
  relatedGroups: string[][];
  activeFlow: Flow | null;
  activeFlowId: string | null;
  setActiveFlowId: (id: string | null) => void;
  visited: Record<string, number>;
  notes: Record<string, string>;
  onSaveStepNote: (sid: string, t: string) => void;
  onToggleVisited: (sid: string) => void;
  viewport: string;
  setViewport: (v: keyof typeof VIEWPORT_WIDTH) => void;
  issueDraft: {
    notes: string;
    type: IssueType;
    strategic_note: string;
    severity: Issue["severity"] | "";
    evidence_direction: Issue["evidence_direction"] | "";
    componentName: string;
    selector: string;
    patternBreadth: string;
  };
  setIssueDraft: React.Dispatch<
    React.SetStateAction<{
      notes: string;
      type: IssueType;
      strategic_note: string;
      severity: Issue["severity"] | "";
      evidence_direction: Issue["evidence_direction"] | "";
      componentName: string;
      selector: string;
      patternBreadth: string;
    }>
  >;
  onLogIssue: () => void;
  onExportMd: () => void;
  onExportJson: () => void;
  currentStepForIssue: Step | null;
  facadeMode: FacadeMode;
  onApplyFacadeMode: (m: FacadeMode) => void;
  copySelector: string;
  setCopySelector: (s: string) => void;
  copyText: string;
  setCopyText: (s: string) => void;
  onApplyCopy: () => void;
  onRecordCorrection: () => void;
  changeGroups: ChangedFileGroup[];
  strategyState: StrategyState | null;
  flowSession: FlowSession | null;
  sessionHistory: FlowSession[];
  onCopySession: () => void;
  copied: boolean;
}) {
  const {
    changed,
    hotFlows,
    hotAssumptions,
    observations,
    bundle,
    pathname,
    matchingStepIds,
    stale,
    gaps,
    segments,
    selectedSegment,
    setSelectedSegment,
    issues,
    issueTypeCounts,
    relatedGroups,
    activeFlow,
    activeFlowId,
    setActiveFlowId,
    visited,
    notes,
    onSaveStepNote,
    onToggleVisited,
    viewport,
    setViewport,
    issueDraft,
    setIssueDraft,
    onLogIssue,
    onExportMd,
    onExportJson,
    currentStepForIssue,
    facadeMode,
    onApplyFacadeMode,
    copySelector,
    setCopySelector,
    copyText,
    setCopyText,
    onApplyCopy,
    onRecordCorrection,
    changeGroups,
    strategyState,
    flowSession,
    sessionHistory,
    onCopySession,
    copied,
  } = props;

  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  if (!bundle) {
    return (
      <div className="fq-root">
        <div className="fq-header">
          <div className="fq-brand">Flow QA</div>
        </div>
        <div className="fq-body fq-muted">Loading workspace... Run `npm run flow-qa:generate` and serve `/flow-qa`.</div>
      </div>
    );
  }

  if (!bundle.flows.length) {
    return (
      <div className="fq-root">
        <div className="fq-header">
          <div className="fq-brand">Flow QA</div>
        </div>
        <div className="fq-body fq-muted">
          No flows found under <code>/flow-qa</code>. Run{" "}
          <code>npx flow-qa generate --routes public/flow-qa/routes.json</code> (or your routes file), then{" "}
          <code>npx flow-qa git-context</code>.
        </div>
      </div>
    );
  }

  // Filter flows by segment
  const segFlows = selectedSegment
    ? bundle.flows.filter((f) => f.segment === selectedSegment)
    : bundle.flows;

  // Context-aware: find flows matching current page
  const flowsHere = segFlows.filter((f) =>
    f.steps.some((sid) => matchingStepIds.includes(sid))
  );

  // Auto-select flow: stale on this page > hot on this page > any on this page > stale > hot
  const flowHasStaleSteps = (f: Flow) => f.steps.some((sid) => stale.has(sid));
  const suggestedFlow =
    flowsHere.find((f) => flowHasStaleSteps(f)) ??
    flowsHere.find((f) => hotFlows.some((h) => h.id === f.id)) ??
    flowsHere[0] ??
    segFlows.find((f) => flowHasStaleSteps(f)) ??
    hotFlows.find((f) => !selectedSegment || f.segment === selectedSegment) ??
    null;

  // The flow to display in the checklist — selected or suggested
  const displayFlow = activeFlow ?? suggestedFlow;

  // Observations relevant to current page
  const pageObservations = observations.filter((o) => {
    const lower = o.observation.toLowerCase();
    if (pathname.startsWith("/pipeline") && (lower.includes("pipeline") || lower.includes("focus today") || lower.includes("stage"))) return true;
    if (pathname.startsWith("/contacts") && (lower.includes("contact") || lower.includes("outreach") || lower.includes("warmth"))) return true;
    if (pathname.startsWith("/strategy") && (lower.includes("strategy") || lower.includes("alignment") || lower.includes("story") || lower.includes("positioning"))) return true;
    if (pathname.startsWith("/profile") && (lower.includes("profile") || lower.includes("positioning"))) return true;
    if (pathname === "/" && (lower.includes("landing") || lower.includes("onboard"))) return true;
    return false;
  });
  const otherObservations = observations.filter((o) => !pageObservations.includes(o));

  // Strategy: only surface assumptions that are actionable (at_risk or mixed)
  const actionableAssumptions = strategyState?.assumptions.filter(
    (a) => a.status === "at_risk" || a.status === "mixed"
  ) ?? [];

  // Strategy: only surface high/medium signals (skip "low" noise)
  const importantSignals = strategyState?.signals.filter(
    (s) => s.severity === "high" || s.severity === "medium"
  ) ?? [];

  return (
    <div className="fq-root">
      {/* ── HEADER ── */}
      <div className="fq-header">
        <div className="fq-brand">Flow QA</div>
        <select
          className="fq-select fq-flow-dropdown"
          value={activeFlowId ?? ""}
          onChange={(e) => setActiveFlowId(e.target.value || null)}
        >
          <option value="">
            {suggestedFlow ? suggestedFlow.title : "Select a flow..."}
          </option>
          {segFlows.map((f) => {
            const staleCount = f.steps.filter((s) => stale.has(s)).length;
            const hot = hotFlows.some((h) => h.id === f.id);
            const here = flowsHere.some((fh) => fh.id === f.id);
            const tag = staleCount ? ` [${staleCount} stale]` : hot ? " [changed]" : here ? " [here]" : "";
            return (
              <option key={f.id} value={f.id}>
                {f.title}{tag}
              </option>
            );
          })}
        </select>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="fq-body">
        {facadeMode !== "off" && (
          <div className="fq-banner">
            Facade: <strong>{facadeMode}</strong> — preview only.
          </div>
        )}

        {/* Segment picker — with coverage counts baked in */}
        {segments.length > 1 && (
          <div className="fq-segment-picker">
            <button
              type="button"
              className={`fq-segment-btn ${selectedSegment === null ? "fq-segment-btn-active" : ""}`}
              onClick={() => setSelectedSegment(null)}
            >All</button>
            {segments.map((s) => {
              const seg = strategyState?.segments.find((sc) => sc.segment === s);
              const pct = seg ? Math.round(seg.coverage * 100) : null;
              return (
                <button
                  key={s}
                  type="button"
                  className={`fq-segment-btn ${selectedSegment === s ? "fq-segment-btn-active" : ""}`}
                  onClick={() => setSelectedSegment(selectedSegment === s ? null : s)}
                >
                  {s}{pct !== null && <span className="fq-segment-pct">{pct}%</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── ALERTS — only if something needs attention ── */}
        {importantSignals.length > 0 && (
          <div className="fq-alerts">
            {importantSignals.slice(0, 3).map((sig, i) => (
              <div key={i} className={`fq-alert fq-alert-${sig.severity}`}>
                <span className="fq-alert-title">{sig.title}</span>
                <span className="fq-alert-detail">{sig.detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── WHAT CHANGED ── */}
        {changeGroups.length > 0 && (
          <div className="fq-change-section">
            <div className="fq-section-label">What changed</div>
            {changeGroups.map((g, gi) => (
              <div key={gi} className="fq-change-group">
                <div className="fq-change-file">
                  <code>{g.file}</code>
                </div>
                {g.affectedSteps.map(({ stepId, step, flowTitle }) => {
                  const isDone = !!visited[stepId];
                  const isStale = stale.has(stepId);
                  return (
                    <div
                      key={stepId}
                      className="fq-change-step"
                      onClick={() => {
                        const flow = bundle.flows.find((f) => f.steps.includes(stepId));
                        if (flow) setActiveFlowId(flow.id);
                      }}
                    >
                      <span className={`fq-change-dot ${isStale ? "fq-dot-amber" : isDone ? "fq-dot-green" : "fq-dot-muted"}`} />
                      <span className="fq-change-step-text">
                        {step.instructions ?? stepId}
                      </span>
                      <span className="fq-muted" style={{ fontSize: 10, marginLeft: "auto", flexShrink: 0 }}>
                        {flowTitle}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── FLOW CHECKLIST ── */}
        {displayFlow && (() => {
          const visitedCount = displayFlow.steps.filter((s) => visited[s]).length;
          const totalSteps = displayFlow.steps.length;
          const pct = totalSteps > 0 ? Math.round((visitedCount / totalSteps) * 100) : 0;
          const staleInFlow = displayFlow.steps.filter((sid) => stale.has(sid)).length;
          const activeStepIdx = displayFlow.steps.findIndex((sid) => matchingStepIds.includes(sid));
          const nextStaleIdx = displayFlow.steps.findIndex((sid) => stale.has(sid) && !matchingStepIds.includes(sid));
          const nextUnvisitedIdx = nextStaleIdx >= 0
            ? nextStaleIdx
            : displayFlow.steps.findIndex((sid) => !visited[sid]);
          const nextStep = nextUnvisitedIdx >= 0 ? bundle.steps[displayFlow.steps[nextUnvisitedIdx]] : null;

          return (
          <>
            {/* Flow header */}
            <div className="fq-flow-header-compact">
              <h3>{displayFlow.title}</h3>
              {displayFlow.strategic_intent && (() => {
                const si = displayFlow.strategic_intent;
                const short = si.length > 80 ? si.slice(0, 77) + "..." : si;
                return si.length > 80 ? (
                  <details style={{ marginBottom: 4 }}>
                    <summary className="fq-muted" style={{ cursor: "pointer", listStyle: "none" }}>{short}</summary>
                    <div className="fq-muted" style={{ marginTop: 2 }}>{si}</div>
                  </details>
                ) : (
                  <div className="fq-muted" style={{ marginBottom: 4 }}>{si}</div>
                );
              })()}
              {(displayFlow.segment || displayFlow.eval_dimension) && (
                <div className="fq-row" style={{ marginBottom: 4 }}>
                  {displayFlow.segment && <span className="fq-chip">{displayFlow.segment}</span>}
                  {displayFlow.eval_dimension && <span className="fq-chip">{displayFlow.eval_dimension}</span>}
                </div>
              )}
            </div>

            {/* Progress */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="fq-progress-bar" style={{ flex: 1 }}>
                <div className="fq-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="fq-muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                {visitedCount}/{totalSteps}
                {staleInFlow > 0 && <span style={{ color: "var(--fq-warn)", marginLeft: 4 }}>· {staleInFlow} stale</span>}
                {(() => {
                  if (!flowSession || flowSession.flowId !== displayFlow.id) return null;
                  const stats = sessionStats(flowSession);
                  const dwell = dwellLabel(stats.totalDwellMs);
                  return dwell ? <span style={{ marginLeft: 4 }}>· {dwell}</span> : null;
                })()}
              </span>
            </div>
            {flowSession?.completed && flowSession.flowId === displayFlow.id && (
              <div className="fq-session-complete">
                Flow complete
              </div>
            )}

            {/* Contextual observations — folded into flow, before steps */}
            {pageObservations.length > 0 && (
              <details className="fq-collapse" style={{ marginTop: 4 }}>
                <summary>{pageObservations.length} observation{pageObservations.length !== 1 ? "s" : ""} on this page</summary>
                <div style={{ marginTop: 6 }}>
                  {pageObservations.slice(0, 3).map((o, i) => {
                    const text = o.observation;
                    const short = text.length > 80 ? text.slice(0, 77) + "..." : text;
                    return (
                      <div key={i} style={{ fontSize: 12, marginBottom: 4, color: "var(--fq-muted)" }}>
                        {short}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {/* Next step prompt */}
            {nextStep && nextUnvisitedIdx !== activeStepIdx && (
              <div className="fq-next-prompt" title="Navigate to this step">
                <span style={{ color: "var(--fq-warn)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Next</span>
                <span style={{ flex: 1, fontSize: 12 }}>{nextStep.instructions}</span>
                {nextStep.urlPattern && (
                  <code style={{ fontSize: 10, color: "var(--fq-muted)" }}>{nextStep.urlPattern}</code>
                )}
              </div>
            )}

            {/* Step checklist */}
            <div className="fq-checklist">
              {(() => {
                const firstActiveIdx = displayFlow.steps.findIndex((sid) => matchingStepIds.includes(sid));
                return displayFlow.steps.map((sid, idx) => {
                const st = bundle.steps[sid];
                if (!st) return null;
                const isOnThisPage = matchingStepIds.includes(sid);
                const isActive = isOnThisPage && idx === firstActiveIdx;
                const isDone = !!visited[sid];
                const isStale = stale.has(sid);
                const isNext = idx === nextUnvisitedIdx && !isActive;
                const showContext = isActive || isStale;
                const hasNotes = !!(notes[sid]?.trim());
                const notesOpen = expandedNotes === sid;

                return (
                  <div
                    key={sid}
                    className={`fq-check-step ${isActive ? "fq-check-step-active" : ""} ${isNext ? "fq-check-step-next" : ""}`}
                  >
                    <div
                      className={`fq-check-box ${isDone && !isStale ? "fq-check-box-done" : ""} ${isStale ? "fq-check-box-stale" : ""} ${isActive && !isDone && !isStale ? "fq-check-box-active" : ""}`}
                      onClick={() => onToggleVisited(sid)}
                      title={isDone ? "Mark incomplete" : "Mark complete"}
                    >
                      {isDone && !isStale && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {isStale && (
                        <span style={{ fontSize: 10, color: "var(--fq-warn)" }}>&#8635;</span>
                      )}
                    </div>

                    <div className="fq-check-content">
                      <div className={`fq-check-instruction ${isDone && !isActive ? "fq-check-instruction-done" : ""}`}>
                        <span style={{ color: "var(--fq-muted)", marginRight: 4 }}>{idx + 1}.</span>
                        {st.instructions ?? sid}
                        {isActive && <span style={{ color: "var(--fq-accent)", marginLeft: 6, fontSize: 11 }}>&#9679; You're here</span>}
                        {isStale && !isActive && <span className="fq-stale-badge">&#8635; Changed</span>}
                        {(() => {
                          const eng = flowSession?.stepEngagement[sid];
                          const label = eng ? dwellLabel(eng.dwellMs) : "";
                          return label ? <span className="fq-dwell-label">{label}</span> : null;
                        })()}
                      </div>

                      {showContext && (st.success_looks_like || st.failure_signal || st.assumption_dependency) && (() => {
                        const trunc = (s: string, n = 70) => s.length > n ? s.slice(0, n - 1) + "..." : s;
                        return (
                        <details className="fq-check-context" style={{ cursor: "pointer" }}>
                          <summary style={{ listStyle: "none", fontSize: 12 }}>
                            {st.success_looks_like && <span><span style={{ color: "var(--fq-ok)" }}>&#10003;</span> {trunc(st.success_looks_like)} </span>}
                          </summary>
                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            {st.success_looks_like && (
                              <div style={{ marginBottom: 2 }}><span style={{ color: "var(--fq-ok)" }}>&#10003;</span> {st.success_looks_like}</div>
                            )}
                            {st.failure_signal && (
                              <div style={{ marginBottom: 2 }}><span style={{ color: "var(--fq-danger)" }}>&#10007;</span> {st.failure_signal}</div>
                            )}
                            {st.assumption_dependency && (
                              <div><span style={{ color: "var(--fq-warn)" }}>?</span> {st.assumption_dependency}</div>
                            )}
                          </div>
                        </details>
                        );
                      })()}

                      <div className="fq-inline-note-area">
                        {notesOpen ? (
                          <textarea
                            className="fq-textarea fq-inline-note-input"
                            style={{ minHeight: 48 }}
                            placeholder="What did you observe?"
                            value={notes[sid] ?? ""}
                            onChange={(e) => onSaveStepNote(sid, e.target.value)}
                            onBlur={() => {
                              if (!(notes[sid]?.trim())) setExpandedNotes(null);
                            }}
                            autoFocus
                          />
                        ) : hasNotes ? (
                          <div
                            className="fq-inline-note-preview"
                            onClick={() => setExpandedNotes(sid)}
                          >
                            {notes[sid].trim()}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`fq-notes-toggle ${hasNotes ? "fq-notes-toggle-has-note" : ""}`}
                            onClick={() => setExpandedNotes(sid)}
                          >
                            + Note
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          </>
          );
        })()}

        {/* ── ASSUMPTIONS AT RISK — only actionable ones ── */}
        {actionableAssumptions.length > 0 && (
          <details className="fq-collapse" open>
            <summary>
              {actionableAssumptions.length} assumption{actionableAssumptions.length !== 1 ? "s" : ""} need attention
            </summary>
            <div className="fq-assumption-list">
              {actionableAssumptions.slice(0, 5).map((a, i) => (
                <div key={i} className={`fq-assumption fq-assumption-${a.status}`}>
                  <div className="fq-assumption-header">
                    <span className={`fq-assumption-badge fq-badge-${a.status}`}>
                      {a.status === "at_risk" ? "AT RISK" : "MIXED"}
                    </span>
                    <span className="fq-assumption-counts">
                      {a.supports}&#8593; {a.contradicts}&#8595;
                    </span>
                  </div>
                  <div className="fq-assumption-text">{a.assumption}</div>
                </div>
              ))}
              {actionableAssumptions.length > 5 && (
                <div className="fq-muted" style={{ fontSize: 11, marginTop: 4 }}>
                  +{actionableAssumptions.length - 5} more
                </div>
              )}
            </div>
          </details>
        )}

        {/* ── ISSUES ── */}
        {issues.length > 0 && (
          <details className="fq-collapse" open={issues.length <= 3}>
            <summary>
              {issues.length} issue{issues.length !== 1 ? "s" : ""}
              <span className="fq-muted" style={{ marginLeft: 4 }}>
                {[
                  issueTypeCounts.bug && `${issueTypeCounts.bug} bug${issueTypeCounts.bug !== 1 ? "s" : ""}`,
                  issueTypeCounts.ux_friction && `${issueTypeCounts.ux_friction} UX`,
                  issueTypeCounts.strategic_gap && `${issueTypeCounts.strategic_gap} strategic`,
                ].filter(Boolean).join(", ")}
              </span>
            </summary>
            <div className="fq-list" style={{ marginTop: 8 }}>
              {issues.map((i) => {
                const step = bundle.steps[i.stepId];
                return (
                  <div key={i.id} className="fq-card" style={{ padding: 8 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <span className={`fq-chip ${i.type === "bug" ? "fq-chip-hot" : ""}`} style={{ fontSize: 10 }}>{i.type}</span>
                      {i.severity && <span className="fq-muted" style={{ fontSize: 10 }}>{i.severity}</span>}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{i.notes}</div>
                    <div className="fq-muted" style={{ fontSize: 10, marginTop: 4 }}>
                      {step?.instructions ?? i.stepId}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* ── LOG ISSUE ── */}
        {displayFlow && (
          <details className="fq-collapse">
            <summary>Log an issue</summary>
            <div style={{ marginTop: 8 }}>
              {currentStepForIssue?.assumption_dependency && (
                <div style={{ fontSize: 12, marginBottom: 8, padding: "6px 8px", background: "rgba(210,153,34,0.08)", borderRadius: 4 }}>
                  <span style={{ color: "var(--fq-warn)" }}>Assumption:</span> {currentStepForIssue.assumption_dependency}
                </div>
              )}
              <div className="fq-type-grid">
                {(
                  [
                    ["bug", "Bug"],
                    ["ux_friction", "UX"],
                    ["strategic_gap", "Strategic"],
                    ["assumption_evidence", "Evidence"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className="fq-type-btn"
                    data-active={issueDraft.type === val}
                    onClick={() => setIssueDraft((d) => ({ ...d, type: val }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {issueDraft.type === "assumption_evidence" && (
                <>
                  <div className="fq-label" style={{ marginTop: 6 }}>Direction</div>
                  <select
                    className="fq-select"
                    value={issueDraft.evidence_direction}
                    onChange={(e) =>
                      setIssueDraft((d) => ({
                        ...d,
                        evidence_direction: e.target.value as Issue["evidence_direction"],
                      }))
                    }
                  >
                    <option value="">---</option>
                    <option value="supports">supports</option>
                    <option value="contradicts">contradicts</option>
                    <option value="ambiguous">ambiguous</option>
                  </select>
                </>
              )}
              <div className="fq-label" style={{ marginTop: 6 }}>Severity</div>
              <select
                className="fq-select"
                value={issueDraft.severity}
                onChange={(e) =>
                  setIssueDraft((d) => ({
                    ...d,
                    severity: e.target.value as Issue["severity"],
                  }))
                }
              >
                <option value="">---</option>
                <option value="critical">critical</option>
                <option value="major">major</option>
                <option value="minor">minor</option>
                <option value="observation">observation</option>
              </select>
              <div className="fq-label" style={{ marginTop: 6 }}>What happened?</div>
              <textarea
                className="fq-textarea"
                style={{ minHeight: 56 }}
                value={issueDraft.notes}
                onChange={(e) => setIssueDraft((d) => ({ ...d, notes: e.target.value }))}
              />
              <details className="fq-collapse" style={{ marginTop: 4 }}>
                <summary>More fields</summary>
                <div style={{ marginTop: 6 }}>
                  <div className="fq-label">Strategic note</div>
                  <textarea
                    className="fq-textarea"
                    style={{ minHeight: 48 }}
                    value={issueDraft.strategic_note}
                    onChange={(e) => setIssueDraft((d) => ({ ...d, strategic_note: e.target.value }))}
                  />
                  <div className="fq-label">Component</div>
                  <input
                    className="fq-input"
                    value={issueDraft.componentName}
                    onChange={(e) => setIssueDraft((d) => ({ ...d, componentName: e.target.value }))}
                  />
                  <div className="fq-label">Selector</div>
                  <input
                    className="fq-input"
                    value={issueDraft.selector}
                    onChange={(e) => setIssueDraft((d) => ({ ...d, selector: e.target.value }))}
                  />
                </div>
              </details>
              <div className="fq-row" style={{ marginTop: 8 }}>
                <button type="button" className="fq-btn fq-btn-primary" onClick={onLogIssue}>
                  Log issue
                </button>
              </div>
            </div>
          </details>
        )}

        {/* ── OBSERVATIONS — collapsed, deduped from page observations shown above ── */}
        {otherObservations.length > 0 && (
          <details className="fq-collapse">
            <summary>
              {otherObservations.length} observation{otherObservations.length !== 1 ? "s" : ""}
            </summary>
            <div className="fq-list" style={{ marginTop: 8 }}>
              {otherObservations.map((o, i) => (
                <div key={i} style={{ marginBottom: 6, fontSize: 12, color: "var(--fq-muted)" }}>
                  {o.observation}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── TOOLS ── */}
        <details className="fq-collapse">
          <summary>Tools</summary>
          <div style={{ marginTop: 8 }}>
            <div className="fq-row" style={{ marginBottom: 8 }}>
              <button type="button" className="fq-btn" onClick={onExportMd}>Export MD</button>
              <button type="button" className="fq-btn" onClick={onExportJson}>JSON</button>
            </div>
            <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Viewport</div>
            <div className="fq-row" style={{ marginTop: 4 }}>
              {(["375", "414", "768", "full"] as const).map((v) => (
                <button key={v} type="button" className="fq-btn" data-active={viewport === v} onClick={() => setViewport(v)}>
                  {v === "full" ? "Full" : `${v}px`}
                </button>
              ))}
            </div>
            <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 }}>Facade</div>
            <div className="fq-row" style={{ marginTop: 4 }}>
              <button type="button" className="fq-btn" onClick={() => onApplyFacadeMode("off")}>Off</button>
              <button type="button" className="fq-btn" onClick={() => onApplyFacadeMode("empty_state")}>Empty-state</button>
            </div>
          </div>
        </details>
      </div>

      {/* ── STICKY FOOTER ── */}
      <div className="fq-footer">
        <button
          type="button"
          className={`fq-btn fq-btn-copy ${copied ? "fq-btn-copy-done" : ""}`}
          onClick={onCopySession}
        >
          {copied ? "Copied!" : "Copy prompt"}
        </button>
      </div>
    </div>
  );
}
