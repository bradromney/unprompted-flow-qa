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
import { exportJson, exportMarkdown } from "../lib/export-report";
import { clusterRelatedIssues } from "../lib/dedupe";
import {
  applyCopyPatches,
  restoreCopyPatches,
  setFacadeModeOnApp,
  type CopyPatch,
} from "../lib/dom-facade";
import { SIDEBAR_CSS } from "./sidebar-styles";

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
  const [view, setView] = useState<"home" | "flow" | "issues">("home");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [visited, setVisited] = useState<Record<string, number>>(getVisitedSteps);
  const [notes, setNotes] = useState<Record<string, string>>(getStepNotes);
  const [issues, setIssuesState] = useState<Issue[]>(getIssues);
  const [facadeMode, setFacadeModeState] = useState<FacadeMode>(getFacadeMode);
  const [copySelector, setCopySelector] = useState("");
  const [copyText, setCopyText] = useState("");
  const [copyPatches, setCopyPatches] = useState<CopyPatch[]>([]);

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
        view={view}
        setView={setView}
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
      />
    );
  }, [
    enabled,
    open,
    view,
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

function SidebarInner(props: {
  view: "home" | "flow" | "issues";
  setView: (v: "home" | "flow" | "issues") => void;
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
}) {
  const {
    view,
    setView,
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
  } = props;

  if (!bundle) {
    return (
      <div className="fq-root">
        <div className="fq-header">
          <div className="fq-brand">Flow QA</div>
        </div>
        <div className="fq-body fq-muted">Loading workspace… Run `npm run flow-qa:generate` and serve `/flow-qa`.</div>
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

  return (
    <div className="fq-root">
      <div className="fq-header">
        <div>
          <div className="fq-brand">Flow QA</div>
          <div className="fq-muted">Strategic session</div>
        </div>
        <div className="fq-row">
          <button type="button" className="fq-btn" onClick={() => setView("home")}>
            Home
          </button>
          <button type="button" className="fq-btn" onClick={() => setView("issues")}>
            Issues ({issues.length})
          </button>
        </div>
      </div>

      <div className="fq-body">
        {facadeMode !== "off" && (
          <div className="fq-banner">
            Facade mode active: <strong>{facadeMode}</strong> — preview only, not real app state.
          </div>
        )}

        {/* STRATEGY HEALTH BAR — always visible */}
        {(() => {
          const totalSteps = Object.keys(bundle.steps).length;
          const staleCount = stale.size;
          const gapCount = gaps ? gaps.flowsMissingIntent.length : 0;
          const evidenceIssues = issues.filter((i) => i.type === "assumption_evidence");
          const testedCount = new Set(evidenceIssues.map((i) => {
            const step = bundle.steps[i.stepId];
            return step?.assumption_dependency;
          }).filter(Boolean)).size;
          const totalAssumptions = gaps?.totalAssumptions.length ?? 0;
          const allVisitedCount = Object.keys(visited).length;
          const totalFlowSteps = bundle.flows.reduce((n, f) => n + f.steps.length, 0);

          // Determine overall health
          const hasGaps = gapCount > 0;
          const hasStale = staleCount > 0;
          const hasUntested = totalAssumptions > 0 && testedCount < totalAssumptions;
          const allGood = !hasGaps && !hasStale && !hasUntested && allVisitedCount >= totalFlowSteps;

          return (
            <div className="fq-strategy-bar">
              <div className="fq-strategy-title">Strategy</div>
              {allGood ? (
                <span className="fq-stat">
                  <span className="fq-stat-dot fq-dot-green" />All reviewed, coverage complete
                </span>
              ) : (
                <>
                  {hasStale && (
                    <span className="fq-stat">
                      <span className="fq-stat-dot fq-dot-amber" />{staleCount} stale
                    </span>
                  )}
                  {hasGaps && (
                    <span className="fq-stat">
                      <span className="fq-stat-dot fq-dot-red" />{gapCount} missing intent
                    </span>
                  )}
                  {hasUntested && (
                    <span className="fq-stat">
                      <span className="fq-stat-dot fq-dot-amber" />{testedCount}/{totalAssumptions} assumptions tested
                    </span>
                  )}
                  {!hasStale && !hasGaps && !hasUntested && allVisitedCount < totalFlowSteps && (
                    <span className="fq-stat">
                      <span className="fq-stat-dot fq-dot-muted" />{totalFlowSteps - allVisitedCount} steps unvisited
                    </span>
                  )}
                </>
              )}
              {/* Segment picker */}
              {segments.length > 1 && (
                <div className="fq-segment-picker" style={{ width: "100%", marginTop: 4 }}>
                  <button
                    type="button"
                    className={`fq-segment-btn ${selectedSegment === null ? "fq-segment-btn-active" : ""}`}
                    onClick={() => setSelectedSegment(null)}
                  >All</button>
                  {segments.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`fq-segment-btn ${selectedSegment === s ? "fq-segment-btn-active" : ""}`}
                      onClick={() => setSelectedSegment(selectedSegment === s ? null : s)}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {view === "home" && (() => {
          // Segment filter
          const segFlows = selectedSegment
            ? bundle.flows.filter((f) => f.segment === selectedSegment)
            : bundle.flows;
          // Context-aware: find flows matching current page
          const flowsHere = segFlows.filter((f) =>
            f.steps.some((sid) => matchingStepIds.includes(sid))
          );
          // Prioritize: stale flow on this page > hot flow on this page > any flow on this page > hot flow > stale flow
          const flowHasStaleSteps = (f: Flow) => f.steps.some((sid) => stale.has(sid));
          const suggestedFlow =
            flowsHere.find((f) => flowHasStaleSteps(f)) ??
            flowsHere.find((f) => hotFlows.some((h) => h.id === f.id)) ??
            flowsHere[0] ??
            segFlows.find((f) => flowHasStaleSteps(f)) ??
            hotFlows.find((f) => !selectedSegment || f.segment === selectedSegment) ??
            null;
          // Observations relevant to current page
          const pageObservations = observations.filter((o) => {
            const lower = o.observation.toLowerCase();
            // Match observations mentioning components/pages related to current path
            if (pathname.startsWith("/pipeline") && (lower.includes("pipeline") || lower.includes("focus today") || lower.includes("stage"))) return true;
            if (pathname.startsWith("/contacts") && (lower.includes("contact") || lower.includes("outreach") || lower.includes("warmth"))) return true;
            if (pathname.startsWith("/strategy") && (lower.includes("strategy") || lower.includes("alignment") || lower.includes("story") || lower.includes("positioning"))) return true;
            if (pathname.startsWith("/profile") && (lower.includes("profile") || lower.includes("positioning"))) return true;
            if (pathname === "/" && (lower.includes("landing") || lower.includes("onboard"))) return true;
            return false;
          });
          const otherObservations = observations.filter((o) => !pageObservations.includes(o));

          return (
          <>
            {/* PRIMARY CTA — what to do right now */}
            {suggestedFlow && (() => {
              const sugStaleCount = suggestedFlow.steps.filter((s) => stale.has(s)).length;
              const sugVisitedCount = suggestedFlow.steps.filter((s) => visited[s]).length;
              const isStale = sugStaleCount > 0;
              const label = isStale
                ? "Re-review — code changed"
                : flowsHere.includes(suggestedFlow)
                ? "Test this page"
                : "Suggested flow";

              return (
              <div
                className="fq-card"
                style={{ borderLeft: `3px solid ${isStale ? "#d29922" : "#58a6ff"}`, cursor: "pointer" }}
                onClick={() => {
                  setActiveFlowId(suggestedFlow.id);
                  setView("flow");
                }}
              >
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                  {label}
                </div>
                <strong style={{ fontSize: 15 }}>{suggestedFlow.title}</strong>
                <div className="fq-row" style={{ marginTop: 6 }}>
                  <button type="button" className={`fq-btn ${isStale ? "fq-btn" : "fq-btn-primary"}`} style={isStale ? { borderColor: "#d29922", color: "#d29922" } : {}} onClick={(e) => {
                    e.stopPropagation();
                    setActiveFlowId(suggestedFlow.id);
                    setView("flow");
                  }}>
                    {isStale ? `Review ${sugStaleCount} stale` : "Start flow"}
                  </button>
                  <span className="fq-muted" style={{ fontSize: 11 }}>
                    {sugVisitedCount}/{suggestedFlow.steps.length} done
                  </span>
                  {suggestedFlow.eval_dimension && (
                    <span className="fq-chip">{suggestedFlow.eval_dimension}</span>
                  )}
                  {hotFlows.some((h) => h.id === suggestedFlow.id) && (
                    <span className="fq-chip fq-chip-hot">Changed</span>
                  )}
                </div>
              </div>
              );
            })()}

            {/* CONTEXTUAL OBSERVATIONS — truncated one-liners */}
            {pageObservations.length > 0 && (
              <div className="fq-card" style={{ borderLeft: "3px solid #d29922" }}>
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  On this page
                </div>
                {pageObservations.slice(0, 3).map((o, i) => {
                  const text = o.observation;
                  const short = text.length > 90 ? text.slice(0, 87) + "…" : text;
                  return (
                    <details key={i} style={{ fontSize: 12, marginTop: i > 0 ? 2 : 0 }}>
                      <summary style={{ cursor: "pointer", listStyle: "none" }}>
                        <span style={{ color: "var(--fq-muted)", marginRight: 4 }}>›</span>{short}
                      </summary>
                      {text.length > 90 && <div style={{ fontSize: 12, marginTop: 4, paddingLeft: 12, color: "var(--fq-muted)" }}>{text}</div>}
                      {o.suggested_assumption && (
                        <div style={{ fontSize: 11, marginTop: 2, paddingLeft: 12, fontStyle: "italic", color: "var(--fq-warn)" }}>
                          Assumption: {o.suggested_assumption}
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            )}

            {/* OPEN ISSUES SUMMARY — only show if there are issues */}
            {issues.length > 0 && (
              <div className="fq-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{issues.length} issue{issues.length !== 1 ? "s" : ""}</strong>
                    <span className="fq-muted" style={{ marginLeft: 8 }}>
                      {[
                        issueTypeCounts.bug && `${issueTypeCounts.bug} bug${issueTypeCounts.bug !== 1 ? "s" : ""}`,
                        issueTypeCounts.ux_friction && `${issueTypeCounts.ux_friction} UX`,
                        issueTypeCounts.strategic_gap && `${issueTypeCounts.strategic_gap} strategic`,
                        issueTypeCounts.assumption_evidence && `${issueTypeCounts.assumption_evidence} evidence`,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </div>
                <div className="fq-row" style={{ marginTop: 8 }}>
                  <button type="button" className="fq-btn" onClick={() => setView("issues")}>View</button>
                  <button type="button" className="fq-btn fq-btn-primary" onClick={onExportMd}>Export MD</button>
                  <button type="button" className="fq-btn" onClick={onExportJson}>JSON</button>
                </div>
              </div>
            )}

            {/* ALL FLOWS — collapsed, segment-filtered */}
            <details className="fq-collapse">
              <summary style={{ cursor: "pointer" }}>
                All flows ({segFlows.length}{selectedSegment ? ` · ${selectedSegment}` : ""})
              </summary>
              <div className="fq-list" style={{ marginTop: 8 }}>
                {[...segFlows]
                  .sort((a, b) => {
                    // Stale first, then hot, then here, then alpha
                    const aStale = a.steps.some((s) => stale.has(s)) ? 0 : 1;
                    const bStale = b.steps.some((s) => stale.has(s)) ? 0 : 1;
                    if (aStale !== bStale) return aStale - bStale;
                    const ah = hotFlows.some((h) => h.id === a.id) ? 0 : 1;
                    const bh = hotFlows.some((h) => h.id === b.id) ? 0 : 1;
                    if (ah !== bh) return ah - bh;
                    const aHere = flowsHere.some((fh) => fh.id === a.id) ? 0 : 1;
                    const bHere = flowsHere.some((fh) => fh.id === b.id) ? 0 : 1;
                    return aHere - bHere || a.title.localeCompare(b.title);
                  })
                  .map((f) => {
                    const visitedCount = f.steps.filter((s) => visited[s]).length;
                    const staleCount = f.steps.filter((s) => stale.has(s)).length;
                    const hot = hotFlows.some((h) => h.id === f.id);
                    const here = flowsHere.some((fh) => fh.id === f.id);
                    return (
                      <div
                        key={f.id}
                        className={`fq-flow-item ${activeFlowId === f.id ? "fq-flow-item-active" : ""}`}
                        onClick={() => {
                          setActiveFlowId(f.id);
                          setView("flow");
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong>{f.title}</strong>
                          <span>
                            {staleCount > 0 && <span className="fq-chip fq-chip-hot">{staleCount} stale</span>}
                            {hot && !staleCount && <span className="fq-chip fq-chip-hot">Changed</span>}
                            {here && <span className="fq-chip" style={{ marginLeft: 4 }}>Here</span>}
                          </span>
                        </div>
                        <div className="fq-muted">
                          {visitedCount}/{f.steps.length} done
                          {f.segment && <span style={{ marginLeft: 6 }}>· {f.segment}</span>}
                          {f.eval_dimension && (
                            <span className="fq-chip" style={{ marginLeft: 6 }}>
                              {f.eval_dimension}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </details>

            {/* OTHER OBSERVATIONS — collapsed */}
            {otherObservations.length > 0 && (
              <details className="fq-collapse">
                <summary style={{ cursor: "pointer" }}>
                  {pageObservations.length > 0
                    ? `${otherObservations.length} more observation${otherObservations.length !== 1 ? "s" : ""}`
                    : `AI noticed ${observations.length} things`}
                </summary>
                <div className="fq-list" style={{ marginTop: 8 }}>
                  {otherObservations.map((o, i) => (
                    <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                      <strong>{o.type}:</strong> {o.observation}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* EXPORT — only if no issues yet (otherwise shown in issues card above) */}
            {issues.length === 0 && (
              <div className="fq-row">
                <button type="button" className="fq-btn" onClick={onExportMd}>Export MD</button>
                <button type="button" className="fq-btn" onClick={onExportJson}>Export JSON</button>
              </div>
            )}

            {/* TOOLS — viewport, facade */}
            <details className="fq-collapse">
              <summary style={{ cursor: "pointer" }}>Tools</summary>
              <div style={{ marginTop: 8 }}>
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Viewport</div>
                <div className="fq-row" style={{ marginTop: 4 }}>
                  {(["375", "414", "768", "full"] as const).map((v) => (
                    <button key={v} type="button" className="fq-btn" data-active={viewport === v} onClick={() => setViewport(v)}>
                      {v === "full" ? "Full" : `${v}px`}
                    </button>
                  ))}
                </div>
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 12 }}>Facade</div>
                <div className="fq-row" style={{ marginTop: 4 }}>
                  <button type="button" className="fq-btn" onClick={() => onApplyFacadeMode("off")}>Off</button>
                  <button type="button" className="fq-btn" onClick={() => onApplyFacadeMode("empty_state")}>Empty-state</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div className="fq-label">Copy patch — selector</div>
                  <input className="fq-input" value={copySelector} onChange={(e) => setCopySelector(e.target.value)} placeholder="#hero-title" />
                  <div className="fq-label">Replacement</div>
                  <input className="fq-input" value={copyText} onChange={(e) => setCopyText(e.target.value)} placeholder="New text" />
                  <button type="button" className="fq-btn" style={{ marginTop: 4 }} onClick={onApplyCopy}>Apply</button>
                </div>
              </div>
            </details>
          </>
          );
        })()}

        {view === "flow" && activeFlow && (() => {
          const visitedCount = activeFlow.steps.filter((s) => visited[s]).length;
          const totalSteps = activeFlow.steps.length;
          const pct = totalSteps > 0 ? Math.round((visitedCount / totalSteps) * 100) : 0;
          // Find the current active step index and next unvisited step
          const staleInFlow = activeFlow.steps.filter((sid) => stale.has(sid)).length;
          const activeStepIdx = activeFlow.steps.findIndex((sid) => matchingStepIds.includes(sid));
          // Next step: prioritize stale steps, then unvisited
          const nextStaleIdx = activeFlow.steps.findIndex((sid) => stale.has(sid) && !matchingStepIds.includes(sid));
          const nextUnvisitedIdx = nextStaleIdx >= 0
            ? nextStaleIdx
            : activeFlow.steps.findIndex((sid) => !visited[sid]);
          const nextStep = nextUnvisitedIdx >= 0 ? bundle.steps[activeFlow.steps[nextUnvisitedIdx]] : null;
          // Expand notes for a step
          const [expandedNotes, setExpandedNotes] = React.useState<string | null>(null);

          return (
          <>
            {/* Flow header — compact */}
            <div className="fq-flow-header-compact">
              <button type="button" className="fq-btn" style={{ marginBottom: 6 }} onClick={() => setView("home")}>
                ← Back
              </button>
              <h3>{activeFlow.title}</h3>
              {activeFlow.strategic_intent && (() => {
                const si = activeFlow.strategic_intent;
                const short = si.length > 80 ? si.slice(0, 77) + "…" : si;
                return si.length > 80 ? (
                  <details style={{ marginBottom: 6 }}>
                    <summary className="fq-muted" style={{ cursor: "pointer", listStyle: "none" }}>{short}</summary>
                    <div className="fq-muted" style={{ marginTop: 2 }}>{si}</div>
                  </details>
                ) : (
                  <div className="fq-muted" style={{ marginBottom: 6 }}>{si}</div>
                );
              })()}
              <div className="fq-row" style={{ marginBottom: 6 }}>
                {activeFlow.segment && <span className="fq-chip">{activeFlow.segment}</span>}
                {activeFlow.eval_dimension && <span className="fq-chip">{activeFlow.eval_dimension}</span>}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="fq-progress-bar" style={{ flex: 1 }}>
                <div className="fq-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="fq-muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                {visitedCount}/{totalSteps}
                {staleInFlow > 0 && <span style={{ color: "var(--fq-warn)", marginLeft: 4 }}>· {staleInFlow} stale</span>}
              </span>
            </div>

            {/* Next step prompt — guide to what’s next */}
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
                // Only the first matching step in this flow gets "You're here"
                const firstActiveIdx = activeFlow.steps.findIndex((sid) => matchingStepIds.includes(sid));
                return activeFlow.steps.map((sid, idx) => {
                const st = bundle.steps[sid];
                if (!st) return null;
                const isOnThisPage = matchingStepIds.includes(sid);
                const isActive = isOnThisPage && idx === firstActiveIdx; // only first match
                const isDone = !!visited[sid];
                const isStale = stale.has(sid);
                const isNext = idx === nextUnvisitedIdx && !isActive;
                const showContext = isActive || isStale; // Show strategic context for current or stale step
                const hasNotes = !!(notes[sid]?.trim());
                const notesOpen = expandedNotes === sid;

                return (
                  <div
                    key={sid}
                    className={`fq-check-step ${isActive ? "fq-check-step-active" : ""} ${isNext ? "fq-check-step-next" : ""}`}
                  >
                    {/* Checkbox */}
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
                        <span style={{ fontSize: 10, color: "var(--fq-warn)" }}>↻</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="fq-check-content">
                      <div className={`fq-check-instruction ${isDone && !isActive ? "fq-check-instruction-done" : ""}`}>
                        <span style={{ color: "var(--fq-muted)", marginRight: 4 }}>{idx + 1}.</span>
                        {st.instructions ?? sid}
                        {isActive && <span style={{ color: "var(--fq-accent)", marginLeft: 6, fontSize: 11 }}>● You’re here</span>}
                        {isStale && !isActive && <span className="fq-stale-badge">↻ Changed</span>}
                      </div>

                      {/* Inline strategic context — truncated, expandable */}
                      {showContext && (st.success_looks_like || st.failure_signal || st.assumption_dependency) && (() => {
                        const trunc = (s: string, n = 70) => s.length > n ? s.slice(0, n - 1) + "…" : s;
                        return (
                        <details className="fq-check-context" style={{ cursor: "pointer" }}>
                          <summary style={{ listStyle: "none", fontSize: 12 }}>
                            {st.success_looks_like && <span><span style={{ color: "var(--fq-ok)" }}>✓</span> {trunc(st.success_looks_like)} </span>}
                          </summary>
                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            {st.success_looks_like && (
                              <div style={{ marginBottom: 2 }}><span style={{ color: "var(--fq-ok)" }}>✓</span> {st.success_looks_like}</div>
                            )}
                            {st.failure_signal && (
                              <div style={{ marginBottom: 2 }}><span style={{ color: "var(--fq-danger)" }}>✗</span> {st.failure_signal}</div>
                            )}
                            {st.assumption_dependency && (
                              <div><span style={{ color: "var(--fq-warn)" }}>?</span> {st.assumption_dependency}</div>
                            )}
                          </div>
                        </details>
                        );
                      })()}

                      {/* Notes toggle */}
                      <div style={{ marginTop: 2 }}>
                        <button
                          type="button"
                          className="fq-notes-toggle"
                          onClick={() => setExpandedNotes(notesOpen ? null : sid)}
                        >
                          {hasNotes ? "Edit note" : notesOpen ? "Close" : "+ Note"}
                        </button>
                        {notesOpen && (
                          <textarea
                            className="fq-textarea"
                            style={{ minHeight: 48, marginTop: 4 }}
                            placeholder="What did you observe?"
                            value={notes[sid] ?? ""}
                            onChange={(e) => onSaveStepNote(sid, e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
              })()}
            </div>

            {/* Assumptions tested — compact */}
            {!!activeFlow.assumptions_tested?.length && (
              <details className="fq-collapse">
                <summary>Assumptions being tested ({activeFlow.assumptions_tested.length})</summary>
                <div style={{ marginTop: 6 }}>
                  {activeFlow.assumptions_tested.map((a, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 4, paddingLeft: 8, borderLeft: "2px solid var(--fq-warn)" }}>{a}</div>
                  ))}
                </div>
              </details>
            )}

            {/* Log issue — collapsed by default */}
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
                      <option value="">—</option>
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
                  <option value="">—</option>
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
          </>
          );
        })()}

        {view === "issues" && (
          <div className="fq-card">
            <button type="button" className="fq-btn" style={{ marginBottom: 8 }} onClick={() => setView("home")}>
              ← Back
            </button>
            <div className="fq-section-title">Related clusters (v0.5)</div>
            {!relatedGroups.length && <div className="fq-muted">No clusters yet.</div>}
            {relatedGroups.map((g, idx) => (
              <div key={idx} className="fq-muted">
                Cluster {idx + 1}: {g.join(", ")}
              </div>
            ))}
            <div className="fq-section-title" style={{ marginTop: 12 }}>
              All issues
            </div>
            <div className="fq-list">
              {issues.map((i) => (
                <div key={i.id} className="fq-card">
                  <strong>{i.type}</strong> · {i.flowId}/{i.stepId}
                  <div>{i.notes}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
