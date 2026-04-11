import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as htmlToImage from "html-to-image";
import type { Flow, Issue, IssueType, MountFlowQAOptions, Step } from "../lib/types";
import { loadWorkspace, type LoadedWorkspace } from "../lib/loader";
import {
  assumptionsForFlows,
  changedRoutes,
  flowsCoveringChangedRoutes,
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
  const [visited, setVisited] = useState<Record<string, true>>(getVisitedSteps);
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
      for (const sid of matchingStepIds) {
        if (!next[sid]) {
          if (!changed) next = { ...prev };
          changed = true;
          next[sid] = true;
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
        issues={issues}
        issueTypeCounts={issueTypeCounts}
        relatedGroups={relatedGroups}
        activeFlow={activeFlow}
        activeFlowId={activeFlowId}
        setActiveFlowId={setActiveFlowId}
        visited={visited}
        notes={notes}
        onSaveStepNote={onSaveStepNote}
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
  issues: Issue[];
  issueTypeCounts: Record<IssueType, number>;
  relatedGroups: string[][];
  activeFlow: Flow | null;
  activeFlowId: string | null;
  setActiveFlowId: (id: string | null) => void;
  visited: Record<string, true>;
  notes: Record<string, string>;
  onSaveStepNote: (sid: string, t: string) => void;
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
    issues,
    issueTypeCounts,
    relatedGroups,
    activeFlow,
    activeFlowId,
    setActiveFlowId,
    visited,
    notes,
    onSaveStepNote,
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

        {view === "home" && (() => {
          // Context-aware: find flows matching current page
          const flowsHere = bundle.flows.filter((f) =>
            f.steps.some((sid) => matchingStepIds.includes(sid))
          );
          // Primary suggestion: hot flow on this page > any flow on this page > hot flow anywhere
          const suggestedFlow =
            flowsHere.find((f) => hotFlows.some((h) => h.id === f.id)) ??
            flowsHere[0] ??
            hotFlows[0] ??
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
          // Current step context
          const currentStep = matchingStepIds.length
            ? bundle.steps[matchingStepIds[0]]
            : null;

          return (
          <>
            {/* PRIMARY CTA — what to do right now */}
            {suggestedFlow && (
              <div
                className="fq-card"
                style={{ borderLeft: "3px solid #58a6ff", cursor: "pointer" }}
                onClick={() => {
                  setActiveFlowId(suggestedFlow.id);
                  setView("flow");
                }}
              >
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                  {flowsHere.includes(suggestedFlow) ? `Test this page` : `Suggested flow`}
                </div>
                <strong style={{ fontSize: 15 }}>{suggestedFlow.title}</strong>
                {suggestedFlow.strategic_intent && (
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    {suggestedFlow.strategic_intent}
                  </div>
                )}
                <div className="fq-row" style={{ marginTop: 8 }}>
                  <button type="button" className="fq-btn fq-btn-primary" onClick={(e) => {
                    e.stopPropagation();
                    setActiveFlowId(suggestedFlow.id);
                    setView("flow");
                  }}>
                    Start flow
                  </button>
                  {suggestedFlow.eval_dimension && (
                    <span className="fq-chip">{suggestedFlow.eval_dimension}</span>
                  )}
                  {hotFlows.some((h) => h.id === suggestedFlow.id) && (
                    <span className="fq-chip fq-chip-hot">Changed</span>
                  )}
                </div>
              </div>
            )}

            {/* CONTEXTUAL OBSERVATION — relevant to this page */}
            {pageObservations.length > 0 && (
              <div className="fq-card" style={{ borderLeft: "3px solid #d29922" }}>
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                  On this page
                </div>
                {pageObservations.slice(0, 2).map((o, i) => (
                  <div key={i} style={{ marginTop: i > 0 ? 8 : 4, fontSize: 13 }}>
                    {o.observation}
                    {o.suggested_assumption && (
                      <div className="fq-muted" style={{ marginTop: 2, fontSize: 12, fontStyle: "italic" }}>
                        Assumption: {o.suggested_assumption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* CURRENT STEP CONTEXT — what to look for right now */}
            {currentStep && (
              <div className="fq-card">
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                  What to look for
                </div>
                {currentStep.success_looks_like && (
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    <span style={{ color: "#3fb950" }}>Success:</span> {currentStep.success_looks_like}
                  </div>
                )}
                {currentStep.failure_signal && (
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    <span style={{ color: "#f85149" }}>Failure:</span> {currentStep.failure_signal}
                  </div>
                )}
                {currentStep.assumption_dependency && (
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    <span style={{ color: "#d29922" }}>Assumption:</span> {currentStep.assumption_dependency}
                  </div>
                )}
              </div>
            )}

            {/* GIT-CHANGED ASSUMPTIONS */}
            {!!hotAssumptions.length && (
              <div className="fq-card">
                <div className="fq-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                  Assumptions stressed by recent changes
                </div>
                {hotAssumptions.map((a, i) => (
                  <div key={i} style={{ marginTop: 4, fontSize: 13 }}>{a}</div>
                ))}
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

            {/* ALL FLOWS — collapsed, secondary */}
            <details className="fq-collapse">
              <summary style={{ cursor: "pointer" }}>
                All flows ({bundle.flows.length})
              </summary>
              <div className="fq-list" style={{ marginTop: 8 }}>
                {[...bundle.flows]
                  .sort((a, b) => {
                    const ah = hotFlows.some((h) => h.id === a.id) ? 0 : 1;
                    const bh = hotFlows.some((h) => h.id === b.id) ? 0 : 1;
                    if (ah !== bh) return ah - bh;
                    const aHere = flowsHere.some((fh) => fh.id === a.id) ? 0 : 1;
                    const bHere = flowsHere.some((fh) => fh.id === b.id) ? 0 : 1;
                    return aHere - bHere || a.title.localeCompare(b.title);
                  })
                  .map((f) => {
                    const visitedCount = f.steps.filter((s) => visited[s]).length;
                    const issueCount = issues.filter((i) => i.flowId === f.id).length;
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
                            {hot && <span className="fq-chip fq-chip-hot">Changed</span>}
                            {here && <span className="fq-chip" style={{ marginLeft: 4 }}>Here</span>}
                          </span>
                        </div>
                        <div className="fq-muted">
                          {visitedCount}/{f.steps.length} steps · {issueCount} issues
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

        {view === "flow" && activeFlow && (
          <div className="fq-card">
            <button type="button" className="fq-btn" style={{ marginBottom: 8 }} onClick={() => setView("home")}>
              ← Back
            </button>
            <h3 style={{ margin: "0 0 6px" }}>{activeFlow.title}</h3>
            {activeFlow.strategic_intent && <div className="fq-muted">{activeFlow.strategic_intent}</div>}
            <div className="fq-row" style={{ margin: "8px 0" }}>
              {activeFlow.segment && <span className="fq-chip">segment: {activeFlow.segment}</span>}
              {activeFlow.jtbd && <span className="fq-chip">jtbd</span>}
              {activeFlow.eval_dimension && <span className="fq-chip">{activeFlow.eval_dimension}</span>}
            </div>
            {!!activeFlow.assumptions_tested?.length && (
              <details open>
                <summary className="fq-muted">Assumptions tested</summary>
                <ul>
                  {activeFlow.assumptions_tested.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="fq-section-title" style={{ marginTop: 12 }}>
              Steps
            </div>
            {activeFlow.steps.map((sid) => {
              const st = bundle.steps[sid];
              if (!st) return null;
              const isMatch = matchingStepIds.includes(sid);
              const isVis = !!visited[sid];
              return (
                <div key={sid} className={`fq-step ${isVis ? "fq-step-done" : ""}`}>
                  <div>
                    <strong>{st.instructions ?? sid}</strong>{" "}
                    {isMatch && <span className="fq-chip fq-chip-hot">active</span>}
                  </div>
                  <div className="fq-muted">
                    <code>{st.urlPattern}</code>
                  </div>
                  <details>
                    <summary className="fq-muted">Expected experience</summary>
                    {st.expected_emotion && <div>Emotion: {st.expected_emotion}</div>}
                    {st.success_looks_like && <div>Success: {st.success_looks_like}</div>}
                    {st.failure_signal && <div>Failure signal: {st.failure_signal}</div>}
                    {st.assumption_dependency && <div>Assumption: {st.assumption_dependency}</div>}
                  </details>
                  <div className="fq-label">Notes</div>
                  <textarea
                    className="fq-textarea"
                    value={notes[sid] ?? ""}
                    onChange={(e) => onSaveStepNote(sid, e.target.value)}
                  />
                </div>
              );
            })}

            <div className="fq-section-title" style={{ marginTop: 12 }}>
              Log issue
            </div>
            {currentStepForIssue?.assumption_dependency && (
              <div className="fq-card" style={{ marginBottom: 8 }}>
                <div className="fq-label">Assumption in play</div>
                <div>{currentStepForIssue.assumption_dependency}</div>
              </div>
            )}
            <div className="fq-type-grid">
              {(
                [
                  ["bug", "Bug"],
                  ["ux_friction", "UX friction"],
                  ["strategic_gap", "Strategic gap"],
                  ["assumption_evidence", "Assumption evidence"],
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
                <div className="fq-label">Evidence direction</div>
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
            <div className="fq-label">Severity</div>
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
            <div className="fq-label">Notes</div>
            <textarea
              className="fq-textarea"
              value={issueDraft.notes}
              onChange={(e) => setIssueDraft((d) => ({ ...d, notes: e.target.value }))}
            />
            <div className="fq-label">Strategic note (optional)</div>
            <textarea
              className="fq-textarea"
              value={issueDraft.strategic_note}
              onChange={(e) => setIssueDraft((d) => ({ ...d, strategic_note: e.target.value }))}
            />
            <div className="fq-label">Component name (optional)</div>
            <input
              className="fq-input"
              value={issueDraft.componentName}
              onChange={(e) => setIssueDraft((d) => ({ ...d, componentName: e.target.value }))}
            />
            <div className="fq-label">Selector (optional)</div>
            <input
              className="fq-input"
              value={issueDraft.selector}
              onChange={(e) => setIssueDraft((d) => ({ ...d, selector: e.target.value }))}
            />
            <div className="fq-label">Pattern breadth N (optional)</div>
            <input
              className="fq-input"
              value={issueDraft.patternBreadth}
              onChange={(e) => setIssueDraft((d) => ({ ...d, patternBreadth: e.target.value }))}
            />
            <div className="fq-row" style={{ marginTop: 8 }}>
              <button type="button" className="fq-btn fq-btn-primary" onClick={onLogIssue}>
                Capture + log issue
              </button>
              <button type="button" className="fq-btn" onClick={onRecordCorrection}>
                I’m on this step (correction)
              </button>
            </div>
          </div>
        )}

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
