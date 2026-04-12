import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Flow, Issue, IssueType, MountFlowQAOptions, Step } from "../lib/types";
import type { LoadedWorkspace } from "../lib/loader";
import type { ChangedFileGroup } from "../lib/git-map";
import { strategicGaps } from "../lib/git-map";
import type { FacadeMode } from "../lib/storage";
import type { StrategyState } from "../lib/strategy-inference";
import { dwellLabel, sessionStats, type FlowSession } from "../lib/session-tracker";
import { SIDEBAR_CSS } from "./sidebar-styles";
import { useFlowQAStore } from "./useFlowQAStore";

/* Humanize snake_case observation types into readable labels */
const OBS_TYPE_LABELS: Record<string, string> = {
  code_strategy_gap: "Strategy gap",
  implementation_inconsistency: "Inconsistency",
  complexity_concentration: "Complexity risk",
  captured_but_unused_data: "Unused data",
  cross_page_disconnect: "Disconnect",
  infrastructure_gap: "Infra gap",
  missed_connection: "Missed connection",
  hidden_feature: "Hidden feature",
};
function humanizeObsType(raw: string): string {
  return OBS_TYPE_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Truncate observation text for sidebar display */
function truncateObs(text: string, max = 120): { short: string; truncated: boolean } {
  if (text.length <= max) return { short: text, truncated: false };
  // Find sentence boundary near max
  const cut = text.lastIndexOf(". ", max);
  const end = cut > max * 0.5 ? cut + 1 : max;
  return { short: text.slice(0, end) + "…", truncated: true };
}

/* Expandable observation card */
function ObservationCard({ o }: { o: { observation: string; type: string; suggested_assumption?: string } }) {
  const [expanded, setExpanded] = useState(false);
  const { short, truncated } = truncateObs(o.observation);
  return (
    <div className="fq-observation-card" onClick={truncated ? () => setExpanded(!expanded) : undefined} style={truncated ? { cursor: "pointer" } : undefined}>
      <div className="fq-observation-card-type">{humanizeObsType(o.type)}</div>
      <div className="fq-observation-card-text">{expanded ? o.observation : short}</div>
      {expanded && o.suggested_assumption && (
        <div className="fq-observation-card-assumption">
          Assumption: {o.suggested_assumption}
        </div>
      )}
    </div>
  );
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

  const store = useFlowQAStore({
    routeConfig,
    getLocation,
    enabled,
    subscribeLocation,
    flowQaAssetBase,
    gitContextPath,
    getAppViewportEl: () => appViewportRef.current,
  });

  // Apply facade mode to DOM when ref or facadeMode changes
  useEffect(() => {
    if (!enabled) return;
    store.applyFacadeToDOM();
  }, [enabled, store.facadeMode, appViewportRef]);

  // Read all state from store
  const {
    open,
    bundle,
    pathname,
    viewport,
    activeFlowId,
    copied,
    visited,
    notes,
    issues,
    facadeMode,
    copySelector,
    copyText,
    issueDraft,
    selectedSegment,
    changed,
    hotFlows,
    hotAssumptions,
    observations,
    matchingStepIds,
    stale,
    gaps,
    segments,
    changeGroups,
    strategyState,
    activeFlow,
    issueTypeCounts,
    relatedGroups,
    currentStepForIssue,
    flowSession,
    sessionHistory,
  } = store;

  const width = VIEWPORT_WIDTH[viewport];

  const sidebarHostRef = useRef<HTMLDivElement>(null);
  const sidebarRootRef = useRef<Root | null>(null);

  // Stable callbacks that delegate to store
  const setActiveFlowId = useCallback((id: string | null) => store.setActiveFlowId(id), [store]);
  const setSelectedSegment = useCallback((s: string | null) => store.setSelectedSegment(s), [store]);
  const setViewport = useCallback((v: keyof typeof VIEWPORT_WIDTH) => store.setViewport(v), [store]);
  const setIssueDraft = useCallback(
    (updater: React.SetStateAction<typeof issueDraft>) => {
      if (typeof updater === "function") {
        store.setIssueDraft(updater);
      } else {
        store.setIssueDraft(updater);
      }
    },
    [store]
  );
  const setCopySelector = useCallback((s: string) => store.setCopySelector(s), [store]);
  const setCopyText = useCallback((s: string) => store.setCopyText(s), [store]);
  const onSaveStepNote = useCallback((sid: string, t: string) => store.onSaveStepNote(sid, t), [store]);
  const onToggleVisited = useCallback((sid: string) => store.onToggleVisited(sid), [store]);
  const onLogIssue = useCallback(() => store.onLogIssue(), [store]);
  const onExportMd = useCallback(() => store.onExportMd(), [store]);
  const onExportJson = useCallback(() => store.onExportJson(), [store]);
  const onCopySession = useCallback(() => store.onCopySession(), [store]);
  const onApplyFacadeMode = useCallback((m: FacadeMode) => store.onApplyFacadeMode(m), [store]);
  const onApplyCopy = useCallback(() => store.onApplyCopy(), [store]);
  const onRecordCorrection = useCallback(() => store.onRecordCorrection(), [store]);

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
        flowSession={flowSession}
        sessionHistory={sessionHistory}
        onCopySession={onCopySession}
        copied={copied}
      />
    );
  });

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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
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
              borderLeft: "1px solid #2E2D3A",
              background: "#111015",
              overflow: "hidden",
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
          onClick={() => store.setOpen(true)}
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

  // Priority flows — ranked by urgency, shown as compact list with chips
  const priorityFlows = (() => {
    if (!bundle) return [];
    return segFlows
      .map((f) => {
        const unchecked = f.steps.filter((sid) => !visited[sid]).length;
        const changed = f.steps.filter((sid) => stale.has(sid)).length;
        const isHere = f.steps.some((sid) => matchingStepIds.includes(sid));
        const issueCount = issues.filter((i) => i.flowId === f.id).length;
        // Urgency score: changed steps weigh most, then unchecked, then issues
        const urgency = changed * 3 + unchecked * 2 + issueCount + (isHere ? 1 : 0);
        return { flow: f, unchecked, changed, isHere, issueCount, urgency, total: f.steps.length };
      })
      .filter((pf) => (pf.unchecked > 0 || pf.changed > 0) && pf.flow.id !== displayFlow?.id)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 3);
  })();

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
                  {s}{pct !== null && <span className="fq-segment-pct" title={`${pct}% of steps checked`}>{pct}%</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── PRIORITY FLOWS ── */}
        {!displayFlow && priorityFlows.length > 0 && (
          <div className="fq-priority-flows">
            {priorityFlows.map((pf) => (
              <div
                key={pf.flow.id}
                className={`fq-priority-flow ${pf.isHere ? "fq-priority-flow-here" : ""}`}
                onClick={() => setActiveFlowId(pf.flow.id)}
              >
                <div className="fq-priority-flow-top">
                  <div className="fq-priority-flow-title">{pf.flow.title}</div>
                  <span className="fq-priority-flow-count">{pf.total - pf.unchecked}/{pf.total}</span>
                </div>
                <div className="fq-priority-flow-bar">
                  <div
                    className={`fq-priority-flow-fill ${pf.unchecked === pf.total ? "fq-priority-flow-fill-empty" : ""}`}
                    style={{ width: `${Math.round(((pf.total - pf.unchecked) / pf.total) * 100)}%` }}
                  />
                </div>
                <div className="fq-priority-flow-chips">
                  {pf.changed > 0 && (
                    <span className="fq-pf-chip fq-pf-chip-changed">
                      {pf.changed} changed
                    </span>
                  )}
                  {pf.issueCount > 0 && (
                    <span className="fq-pf-chip fq-pf-chip-issues">
                      {pf.issueCount} issue{pf.issueCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {pf.isHere && (
                    <span className="fq-pf-chip fq-pf-chip-here">you're here</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* All caught up — when no flows need attention */}
        {!displayFlow && priorityFlows.length === 0 && segFlows.length > 0 && (
          <div className="fq-all-clear">
            <span className="fq-all-clear-icon">✓</span>
            <span className="fq-all-clear-title">All caught up</span>
            <span className="fq-all-clear-detail">
              {segFlows.length} flow{segFlows.length !== 1 ? "s" : ""} checked · {issues.length} issue{issues.length !== 1 ? "s" : ""} logged
            </span>
          </div>
        )}
        {/* Other flows on this page — compact hint when a flow is active */}
        {displayFlow && flowsHere.length > 1 && (
          <div className="fq-other-flows-hint">
            {flowsHere.length - 1} other flow{flowsHere.length - 1 !== 1 ? "s" : ""} also touch{flowsHere.length - 1 === 1 ? "es" : ""} this page
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
              {displayFlow.eval_dimension && (
                <div className="fq-row" style={{ marginBottom: 4 }}>
                  <span className="fq-chip">{displayFlow.eval_dimension}</span>
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
                <span className="fq-complete-icon">✓</span>
                <span className="fq-complete-title">Flow complete</span>
                <span className="fq-complete-detail">
                  {totalSteps} step{totalSteps !== 1 ? "s" : ""} checked
                  {issues.filter((i) => i.flowId === displayFlow.id).length > 0
                    ? ` · ${issues.filter((i) => i.flowId === displayFlow.id).length} issue${issues.filter((i) => i.flowId === displayFlow.id).length !== 1 ? "s" : ""} logged`
                    : " · no issues found"}
                </span>
              </div>
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

            {/* Contextual observations — after steps */}
            {pageObservations.length > 0 && (
              <details className="fq-collapse">
                <summary>{pageObservations.length} observation{pageObservations.length !== 1 ? "s" : ""} on this page</summary>
                <div className="fq-observation-list">
                  {pageObservations.map((o, i) => (
                    <ObservationCard key={i} o={o} />
                  ))}
                </div>
              </details>
            )}
          </>
          );
        })()}

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
          <details className="fq-collapse fq-collapse-action">
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
            <div className="fq-observation-list">
              {otherObservations.map((o, i) => (
                <ObservationCard key={i} o={o} />
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
          {copied ? "Copied!" : "Copy QA report"}
        </button>
      </div>
    </div>
  );
}
