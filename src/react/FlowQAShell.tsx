import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Flow, Issue, IssueType, MountFlowQAOptions, Step, StepAssessment } from "../lib/types";
import type { FacadeMode } from "../lib/storage";
import { SIDEBAR_CSS } from "./sidebar-styles";
import { useFlowQAStore } from "./useFlowQAStore";
import type { FlowQAStore } from "../lib/store";

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

/* Humanize kebab-case segment names */
function humanizeSegment(raw: string): string {
  return raw.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Truncate observation text for sidebar display */
function truncateObs(text: string, max = 120): { short: string; truncated: boolean } {
  if (text.length <= max) return { short: text, truncated: false };
  const cut = text.lastIndexOf(". ", max);
  const end = cut > max * 0.5 ? cut + 1 : max;
  return { short: text.slice(0, end) + "…", truncated: true };
}

/* Map observation types to severity categories for color coding */
const OBS_SEVERITY: Record<string, string> = {
  complexity_concentration: "risk",
  infrastructure_gap: "gap",
  code_strategy_gap: "gap",
  implementation_inconsistency: "risk",
  cross_page_disconnect: "risk",
  captured_but_unused_data: "opportunity",
  missed_connection: "opportunity",
  hidden_feature: "info",
};

/* Expandable observation card */
function ObservationCard({ o }: { o: { observation: string; type: string; suggested_assumption?: string } }) {
  const [expanded, setExpanded] = useState(false);
  const { short, truncated } = truncateObs(o.observation);
  const severity = OBS_SEVERITY[o.type] ?? "info";
  return (
    <div className="fq-observation-card" data-type={severity} onClick={truncated ? () => setExpanded(!expanded) : undefined} style={truncated ? { cursor: "pointer" } : undefined}>
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
    navigate,
  } = props;

  const store = useFlowQAStore({
    routeConfig,
    getLocation,
    enabled,
    subscribeLocation,
    flowQaAssetBase,
    gitContextPath,
    getAppViewportEl: () => appViewportRef.current,
    navigate,
  });

  // Apply facade mode to DOM when ref or facadeMode changes
  useEffect(() => {
    if (!enabled) return;
    store.applyFacadeToDOM();
  }, [enabled, store.facadeMode, appViewportRef]);

  const { open, viewport, copied } = store;
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

    sidebarRootRef.current?.render(<SidebarInner store={store} />);
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

function SidebarInner({ store }: { store: FlowQAStore }) {
  const {
    bundle,
    pathname,
    visited,
    notes,
    issues,
    stale,
    hotFlows,
    observations,
    matchingStepIds,
    segments,
    selectedSegment,
    changeGroups,
    strategyState,
    facadeMode,
    viewport,
    issueDraft,
    copied,
    flowsOnPage,
    expandedFlowIds,
    stepAssessments,
    issueTypeCounts,
  } = store;

  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null);
  const [expandedChanges, setExpandedChanges] = useState<string | null>(null);
  const [flowsVisible, setFlowsVisible] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [issueInputFocused, setIssueInputFocused] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  /* ── Loading / empty states ── */

  if (!bundle) {
    return (
      <div className="fq-root">
        <div className="fq-header"><div className="fq-brand">Flow QA</div></div>
        <div className="fq-body fq-muted">Loading workspace...</div>
      </div>
    );
  }

  if (!bundle.flows.length) {
    return (
      <div className="fq-root">
        <div className="fq-header"><div className="fq-brand">Flow QA</div></div>
        <div className="fq-body fq-muted">
          No flows found. Run <code>npx flow-qa generate</code> then <code>npx flow-qa git-context</code>.
        </div>
      </div>
    );
  }

  /* ── Derived data ── */

  const segFlows = selectedSegment
    ? bundle.flows.filter((f) => f.segment === selectedSegment)
    : bundle.flows;

  const otherFlows = segFlows.filter((f) => !flowsOnPage.some((fp) => fp.id === f.id));

  /* ── Changes bucketed by page ── */
  const onPageChangesByStep = new Map<string, { step: Step; files: Set<string>; flowTitles: Set<string> }>();
  const offPageByRoute = new Map<string, { count: number; firstTitle?: string }>();
  for (const group of changeGroups) {
    for (const a of group.affectedSteps) {
      if (!stale.has(a.stepId)) continue; // already reviewed since change
      if (matchingStepIds.includes(a.stepId)) {
        const cur = onPageChangesByStep.get(a.stepId) ?? {
          step: a.step,
          files: new Set<string>(),
          flowTitles: new Set<string>(),
        };
        cur.files.add(group.file);
        if (a.flowTitle) cur.flowTitles.add(a.flowTitle);
        onPageChangesByStep.set(a.stepId, cur);
      } else {
        const route = a.step.urlPattern;
        const cur = offPageByRoute.get(route) ?? { count: 0, firstTitle: a.step.instructions };
        cur.count += 1;
        offPageByRoute.set(route, cur);
      }
    }
  }
  const onPageChanges = [...onPageChangesByStep.entries()].map(([stepId, v]) => ({
    stepId,
    step: v.step,
    files: [...v.files],
    flowTitles: [...v.flowTitles],
  }));
  const hasCoverageOnPage = matchingStepIds.length > 0;
  const showAllClear = hasCoverageOnPage && onPageChanges.length === 0;

  return (
    <div className="fq-root">
      {/* ── HEADER ── */}
      <div className="fq-header">
        <div className="fq-brand">Flow QA</div>
        <div style={{ flex: 1 }} />
        {segments.length > 1 && (
          <select
            className="fq-select fq-segment-dropdown"
            value={selectedSegment ?? ""}
            onChange={(e) => store.setSelectedSegment(e.target.value || null)}
          >
            <option value="">All segments</option>
            {segments.map((s) => {
              const seg = strategyState?.segments.find((sc) => sc.segment === s);
              const pct = seg ? Math.round(seg.coverage * 100) : null;
              return (
                <option key={s} value={s}>
                  {humanizeSegment(s)}{pct !== null ? ` (${pct}%)` : ""}
                </option>
              );
            })}
          </select>
        )}
        <button
          type="button"
          className="fq-gear-btn"
          onClick={() => setToolsOpen(!toolsOpen)}
          title="Tools"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 1.5h3l.4 1.6.7.3 1.4-.8 2.1 2.1-.8 1.4.3.7 1.6.4v3l-1.6.4-.3.7.8 1.4-2.1 2.1-1.4-.8-.7.3-.4 1.6h-3l-.4-1.6-.7-.3-1.4.8-2.1-2.1.8-1.4-.3-.7L.8 9.5v-3l1.6-.4.3-.7-.8-1.4 2.1-2.1 1.4.8.7-.3.4-1.6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
      </div>

      {/* ── TOOLS OVERLAY ── */}
      {toolsOpen && (
        <>
          <div className="fq-tools-backdrop" onClick={() => setToolsOpen(false)} />
          <div className="fq-tools-panel">
            <div className="fq-tools-panel-header">
              <span className="fq-tools-panel-title">Tools</span>
              <button type="button" className="fq-gear-btn" onClick={() => setToolsOpen(false)}>✕</button>
            </div>
            <div className="fq-tools-panel-section">
              <div className="fq-tools-panel-label">Export</div>
              <div className="fq-row">
                <button type="button" className="fq-btn" onClick={() => { store.onExportMd(); setToolsOpen(false); }}>Markdown</button>
                <button type="button" className="fq-btn" onClick={() => { store.onExportJson(); setToolsOpen(false); }}>JSON</button>
              </div>
            </div>
            <div className="fq-tools-panel-section">
              <div className="fq-tools-panel-label">Viewport</div>
              <div className="fq-row">
                {(["375", "414", "768", "full"] as const).map((v) => (
                  <button key={v} type="button" className="fq-btn" data-active={viewport === v} onClick={() => { store.setViewport(v); setToolsOpen(false); }}>
                    {v === "full" ? "Full" : `${v}px`}
                  </button>
                ))}
              </div>
            </div>
            <div className="fq-tools-panel-section">
              <div className="fq-tools-panel-label">Facade</div>
              <div className="fq-row">
                <button type="button" className="fq-btn" onClick={() => { store.onApplyFacadeMode("off"); setToolsOpen(false); }}>Off</button>
                <button type="button" className="fq-btn" onClick={() => { store.onApplyFacadeMode("empty_state"); setToolsOpen(false); }}>Empty-state</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── SCROLLABLE BODY ── */}
      <div className="fq-body">
        {facadeMode !== "off" && (
          <div className="fq-banner">
            Facade: <strong>{facadeMode}</strong> — preview only.
          </div>
        )}

        {/* ── ROUTE BAR ── */}
        <div className="fq-route-bar">
          <code className="fq-route-path">{pathname}</code>
        </div>

        {/* ── CHANGES ON THIS PAGE (primary) ── */}
        {onPageChanges.length > 0 && (
          <div className="fq-changes-section">
            <div className="fq-section-label">
              {onPageChanges.length} change{onPageChanges.length !== 1 ? "s" : ""} to review
            </div>
            {onPageChanges.map((c) => (
              <ChangeRow
                key={c.stepId}
                stepId={c.stepId}
                step={c.step}
                files={c.files}
                flowTitles={c.flowTitles}
                store={store}
                bundle={bundle}
                assessment={stepAssessments[c.stepId]}
                expanded={expandedChanges === c.stepId}
                setExpanded={(v) => setExpandedChanges(v ? c.stepId : null)}
              />
            ))}
          </div>
        )}

        {/* ── ALL CLEAR (empty state when coverage exists but nothing stale) ── */}
        {showAllClear && (
          <div className="fq-all-clear-card">
            <span className="fq-all-clear-icon">✓</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span className="fq-all-clear-title">All clear</span>
              <span className="fq-all-clear-detail">No changes since your last review</span>
            </div>
          </div>
        )}

        {/* ── OTHER PAGES WITH CHANGES ── */}
        {offPageByRoute.size > 0 && (
          <div className="fq-other-changes-section">
            <div className="fq-section-label">Other pages with changes</div>
            {[...offPageByRoute.entries()].map(([route, info]) => (
              <div
                key={route}
                className="fq-other-change-item"
                onClick={() => store.requestNavigation(route)}
              >
                <code className="fq-route-path-small">{route}</code>
                <span className="fq-muted" style={{ fontSize: 11, marginLeft: "auto" }}>
                  {info.count} change{info.count !== 1 ? "s" : ""}
                </span>
                <span className="fq-chevron-right">›</span>
              </div>
            ))}
          </div>
        )}

        {/* ── FLOWS (secondary, collapsible) ── */}
        {flowsOnPage.length > 0 && (
          <div className="fq-flows-toggle-section">
            <button
              type="button"
              className="fq-flows-toggle"
              onClick={() => setFlowsVisible(!flowsVisible)}
            >
              <span className={`fq-chevron ${flowsVisible ? "fq-chevron-open" : ""}`}>›</span>
              <span>View as flow journey</span>
              <span className="fq-muted" style={{ fontSize: 11, marginLeft: "auto" }}>
                {flowsOnPage.length} flow{flowsOnPage.length !== 1 ? "s" : ""} here
              </span>
            </button>
            {flowsVisible && (
              <div className="fq-flow-cards" style={{ marginTop: 6 }}>
                {flowsOnPage.map((flow) => (
                  <FlowCard
                    key={flow.id}
                    flow={flow}
                    store={store}
                    bundle={bundle}
                    expanded={expandedFlowIds.has(flow.id)}
                    visited={visited}
                    notes={notes}
                    stale={stale}
                    hotFlows={hotFlows}
                    issues={issues}
                    matchingStepIds={matchingStepIds}
                    stepAssessments={stepAssessments}
                    expandedCriteria={expandedCriteria}
                    setExpandedCriteria={setExpandedCriteria}
                    expandedNotes={expandedNotes}
                    setExpandedNotes={setExpandedNotes}
                  />
                ))}
                {otherFlows.length > 0 && (
                  <div className="fq-other-flows">
                    <div className="fq-section-label" style={{ fontSize: 10, padding: "4px 0" }}>Other flows</div>
                    {otherFlows.map((f) => {
                      const vc = f.steps.filter((s) => visited[s]).length;
                      const sc = f.steps.filter((s) => stale.has(s)).length;
                      return (
                        <div
                          key={f.id}
                          className="fq-other-flow-item"
                          onClick={() => store.toggleFlowExpanded(f.id)}
                        >
                          <span className="fq-other-flow-title">{f.title}</span>
                          <span className="fq-flow-card-progress">{vc}/{f.steps.length}</span>
                          {sc > 0 && <span className="fq-chip fq-chip-stale">{sc}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ISSUE LOG ── */}
        {store.activeFlowId && (() => {
          const af = bundle.flows.find((f) => f.id === store.activeFlowId);
          const stepForIssue = af
            ? bundle.steps[matchingStepIds.find((id) => af.steps.includes(id)) ?? af.steps[0]]
            : null;
          return (
            <div className="fq-issue-inline">
              <div className="fq-issue-inline-header">
                <span className="fq-issue-inline-label">LOG</span>
                {af && <span className="fq-muted" style={{ fontSize: 10 }}>{af.title}</span>}
              </div>
              <textarea
                className="fq-issue-inline-input"
                placeholder="Something off? Log an issue…"
                value={issueDraft.notes}
                rows={1}
                onFocus={() => setIssueInputFocused(true)}
                onChange={(e) => {
                  store.setIssueDraft((d) => ({ ...d, notes: e.target.value }));
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
                }}
              />
              {issueInputFocused && (
                <div className="fq-issue-inline-fields">
                  {stepForIssue?.assumption_dependency && (
                    <div className="fq-issue-inline-assumption">
                      <span style={{ color: "var(--fq-warn)" }}>Assumption:</span> {stepForIssue.assumption_dependency}
                    </div>
                  )}
                  <div className="fq-issue-inline-row">
                    <select
                      className="fq-select fq-issue-select"
                      value={issueDraft.type}
                      onChange={(e) => store.setIssueDraft((d) => ({ ...d, type: e.target.value as IssueType }))}
                    >
                      <option value="bug">Bug</option>
                      <option value="ux_friction">UX friction</option>
                      <option value="strategic_gap">Strategic gap</option>
                      <option value="assumption_evidence">Evidence</option>
                    </select>
                    <select
                      className="fq-select fq-issue-select"
                      value={issueDraft.severity}
                      onChange={(e) =>
                        store.setIssueDraft((d) => ({
                          ...d,
                          severity: e.target.value as Issue["severity"],
                        }))
                      }
                    >
                      <option value="">Severity…</option>
                      <option value="critical">Critical</option>
                      <option value="major">Major</option>
                      <option value="minor">Minor</option>
                      <option value="observation">Note</option>
                    </select>
                  </div>
                  {issueDraft.type === "assumption_evidence" && (
                    <select
                      className="fq-select"
                      style={{ fontSize: 11, padding: "3px 6px", width: "auto" }}
                      value={issueDraft.evidence_direction}
                      onChange={(e) =>
                        store.setIssueDraft((d) => ({
                          ...d,
                          evidence_direction: e.target.value as Issue["evidence_direction"],
                        }))
                      }
                    >
                      <option value="">Direction…</option>
                      <option value="supports">supports</option>
                      <option value="contradicts">contradicts</option>
                      <option value="ambiguous">ambiguous</option>
                    </select>
                  )}
                  <div className="fq-issue-inline-actions">
                    <button
                      type="button"
                      className="fq-btn fq-btn-primary"
                      style={{ fontSize: 11, padding: "4px 12px" }}
                      onClick={() => { store.onLogIssue(); setIssueInputFocused(false); }}
                    >Log</button>
                    <button
                      type="button"
                      className="fq-btn"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => setIssueInputFocused(false)}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ISSUES LIST ── */}
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

      </div>

      {/* ── FOOTER — export with format picker ── */}
      <div className="fq-footer">
        <div style={{ position: "relative", display: "flex", gap: 0 }}>
          <button
            type="button"
            className={`fq-btn fq-btn-copy-subtle ${copied ? "fq-btn-copy-done" : ""}`}
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            onClick={() => store.onCopySession()}
          >
            {copied ? "✓ Copied" : "Copy fix prompt"}
          </button>
          <button
            type="button"
            className="fq-btn fq-export-chevron"
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: "4px 8px", borderLeft: "1px solid var(--fq-border)" }}
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
          >▾</button>
          {exportMenuOpen && (
            <div className="fq-export-menu">
              <button type="button" onClick={() => { store.onCopyFixPrompt(); setExportMenuOpen(false); }}>Fix these</button>
              <button type="button" onClick={() => { store.onCopyAnalysis(); setExportMenuOpen(false); }}>Our analysis</button>
              <button type="button" onClick={() => { store.onCopyFullSession(); setExportMenuOpen(false); }}>Full session</button>
              <button type="button" onClick={() => { store.onCopyRawNotes(); setExportMenuOpen(false); }}>Just my notes</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── FlowCard ─────────────────────────────────────────────────────────────── */

function FlowCard({
  flow,
  store,
  bundle,
  expanded,
  visited,
  notes,
  stale,
  hotFlows,
  issues,
  matchingStepIds,
  stepAssessments,
  expandedCriteria,
  setExpandedCriteria,
  expandedNotes,
  setExpandedNotes,
}: {
  flow: Flow;
  store: FlowQAStore;
  bundle: { flows: Flow[]; steps: Record<string, Step> };
  expanded: boolean;
  visited: Record<string, number>;
  notes: Record<string, string>;
  stale: Set<string>;
  hotFlows: Flow[];
  issues: Issue[];
  matchingStepIds: string[];
  stepAssessments: Record<string, StepAssessment>;
  expandedCriteria: string | null;
  setExpandedCriteria: (id: string | null) => void;
  expandedNotes: string | null;
  setExpandedNotes: (id: string | null) => void;
}) {
  const visitedCount = flow.steps.filter((s) => visited[s]).length;
  const staleCount = flow.steps.filter((s) => stale.has(s)).length;
  const issueCount = issues.filter((i) => i.flowId === flow.id).length;
  const isHot = staleCount > 0 || hotFlows.some((h) => h.id === flow.id);

  return (
    <div className={`fq-flow-card ${isHot ? "fq-flow-card-hot" : ""}`}>
      {/* ── Collapsed header ── */}
      <div className="fq-flow-card-header" onClick={() => store.toggleFlowExpanded(flow.id)}>
        <span className="fq-flow-card-title">{flow.title}</span>
        <span className="fq-flow-card-progress">{visitedCount}/{flow.steps.length}</span>
        {staleCount > 0 && <span className="fq-chip fq-chip-stale">{staleCount} stale</span>}
        {issueCount > 0 && <span className="fq-chip">{issueCount}</span>}
        <span className={`fq-chevron ${expanded ? "fq-chevron-open" : ""}`}>›</span>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="fq-flow-card-body">
          {flow.strategic_intent && (
            <div className="fq-flow-card-intent">{flow.strategic_intent}</div>
          )}

          {/* Step rows */}
          {flow.steps.map((sid, idx) => {
            const st = bundle.steps[sid];
            if (!st) return null;
            const isHere = matchingStepIds.includes(sid);
            const isDone = !!visited[sid];
            const isStale = stale.has(sid);
            const assessment = stepAssessments[sid];
            const hasCriteria = !!(st.success_looks_like || st.failure_signal || st.assumption_dependency);
            const criteriaOpen = expandedCriteria === sid;
            const hasNotes = !!(notes[sid]?.trim());
            const notesOpen = expandedNotes === sid;

            return (
              <div key={sid} className={`fq-check-step ${isHere ? "fq-check-step-active" : ""}`}>
                {/* Checkbox — de-emphasized */}
                <div
                  className={`fq-check-box ${isDone && !isStale ? "fq-check-box-done" : ""} ${isStale ? "fq-check-box-stale" : ""}`}
                  onClick={() => store.onToggleVisited(sid)}
                  title={isDone ? "Mark incomplete" : "Mark complete"}
                >
                  {isDone && !isStale && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isStale && <span style={{ fontSize: 10 }}>&#8635;</span>}
                </div>

                <div className="fq-check-content">
                  {/* Step instruction — click to expand criteria */}
                  <div
                    className={`fq-check-instruction ${hasCriteria ? "fq-check-instruction-clickable" : ""}`}
                    onClick={hasCriteria ? () => setExpandedCriteria(criteriaOpen ? null : sid) : undefined}
                  >
                    {st.instructions ?? sid}
                    {isHere && <span className="fq-here-dot" />}
                    {isStale && !isHere && <span className="fq-stale-badge">Changed</span>}
                    {assessment && (
                      <span className={`fq-assess-indicator ${assessment.status === "good" ? "fq-assess-good" : "fq-assess-work"}`} />
                    )}
                  </div>

                  {/* Criteria + assessment panel */}
                  {criteriaOpen && hasCriteria && (
                    <div className="fq-step-assess">
                      {st.success_looks_like && (
                        <div className="fq-criteria-row">
                          <span style={{ color: "var(--fq-ok)", flexShrink: 0 }}>✓</span>
                          <span className="fq-criteria-text">
                            {assessment?.editedCriteria ?? st.success_looks_like}
                          </span>
                        </div>
                      )}
                      {st.failure_signal && (
                        <div className="fq-context-line">
                          <span style={{ color: "var(--fq-danger)" }}>✗</span> {st.failure_signal}
                        </div>
                      )}
                      {st.assumption_dependency && (
                        <div className="fq-context-line">
                          <span style={{ color: "var(--fq-warn)" }}>?</span> {st.assumption_dependency}
                        </div>
                      )}

                      {/* Assessment buttons */}
                      <div className="fq-assess-row">
                        <button
                          type="button"
                          className={`fq-assess-btn fq-assess-btn-good ${assessment?.status === "good" ? "fq-assess-active" : ""}`}
                          onClick={() => store.setStepAssessment(sid, { status: "good" })}
                        >Good</button>
                        <button
                          type="button"
                          className={`fq-assess-btn fq-assess-btn-work ${assessment?.status === "needs-work" ? "fq-assess-active" : ""}`}
                          onClick={() => store.setStepAssessment(sid, { status: "needs-work", note: assessment?.note })}
                        >Needs work</button>
                      </div>

                      {/* Needs work note */}
                      {assessment?.status === "needs-work" && (
                        <textarea
                          className="fq-assess-note"
                          placeholder="What needs to change?"
                          value={assessment.note ?? ""}
                          onChange={(e) =>
                            store.setStepAssessment(sid, { ...assessment, note: e.target.value })
                          }
                          rows={2}
                        />
                      )}
                    </div>
                  )}

                  {/* Note toggle */}
                  <div className="fq-inline-note-area">
                    {notesOpen ? (
                      <textarea
                        className="fq-textarea fq-inline-note-input"
                        style={{ minHeight: 48 }}
                        placeholder="What did you observe?"
                        value={notes[sid] ?? ""}
                        onChange={(e) => store.onSaveStepNote(sid, e.target.value)}
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
                        className="fq-notes-toggle"
                        onClick={() => setExpandedNotes(sid)}
                      >
                        + Note
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── ChangeRow ────────────────────────────────────────────────────────────── */

function ChangeRow({
  stepId,
  step,
  files,
  flowTitles,
  store,
  bundle,
  assessment,
  expanded,
  setExpanded,
}: {
  stepId: string;
  step: Step;
  files: string[];
  flowTitles: string[];
  store: FlowQAStore;
  bundle: { flows: Flow[]; steps: Record<string, Step> };
  assessment: StepAssessment | undefined;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}) {
  const hasCriteria = !!(step.success_looks_like || step.failure_signal || step.assumption_dependency);
  const dotClass =
    assessment?.status === "good"
      ? "fq-dot-green"
      : assessment?.status === "needs-work"
      ? "fq-dot-amber"
      : "fq-dot-muted";

  return (
    <div className={`fq-change-row ${assessment ? `fq-change-row-${assessment.status}` : ""}`}>
      <div className="fq-change-row-header" onClick={() => setExpanded(!expanded)}>
        <span className={`fq-change-row-dot ${dotClass}`} />
        <span className="fq-change-row-title">{step.instructions ?? stepId}</span>
        {flowTitles.length > 0 && (
          <span className="fq-change-row-flows">
            {flowTitles.length === 1
              ? flowTitles[0]
              : `${flowTitles.length} flows`}
          </span>
        )}
        <span className={`fq-chevron ${expanded ? "fq-chevron-open" : ""}`}>›</span>
      </div>

      {expanded && (
        <div className="fq-change-row-body">
          {hasCriteria && (
            <div className="fq-change-criteria">
              {step.success_looks_like && (
                <div className="fq-criteria-row">
                  <span style={{ color: "var(--fq-ok)", flexShrink: 0 }}>✓</span>
                  <span className="fq-criteria-text">{step.success_looks_like}</span>
                </div>
              )}
              {step.failure_signal && (
                <div className="fq-criteria-row">
                  <span style={{ color: "var(--fq-danger)", flexShrink: 0 }}>✗</span>
                  <span className="fq-criteria-text">{step.failure_signal}</span>
                </div>
              )}
              {step.assumption_dependency && (
                <div className="fq-criteria-row">
                  <span style={{ color: "var(--fq-warn)", flexShrink: 0 }}>?</span>
                  <span className="fq-criteria-text">{step.assumption_dependency}</span>
                </div>
              )}
            </div>
          )}

          {files.length > 0 && (
            <div className="fq-change-files">
              <span className="fq-muted" style={{ fontSize: 10 }}>Changed:</span>{" "}
              {files.map((f, i) => (
                <span key={f}>
                  {i > 0 && ", "}
                  <code className="fq-change-file-code">{f}</code>
                </span>
              ))}
            </div>
          )}

          <div className="fq-assess-row">
            <button
              type="button"
              className={`fq-assess-btn fq-assess-btn-good ${assessment?.status === "good" ? "fq-assess-active" : ""}`}
              onClick={() => {
                store.setStepAssessment(stepId, { status: "good" });
                store.markStepReviewed(stepId);
              }}
            >
              Good
            </button>
            <button
              type="button"
              className={`fq-assess-btn fq-assess-btn-work ${assessment?.status === "needs-work" ? "fq-assess-active" : ""}`}
              onClick={() => {
                store.setStepAssessment(stepId, { status: "needs-work", note: assessment?.note });
                store.markStepReviewed(stepId);
              }}
            >
              Add note
            </button>
          </div>

          {assessment?.status === "needs-work" && (
            <textarea
              className="fq-assess-note"
              placeholder="What needs to change?"
              value={assessment.note ?? ""}
              onChange={(e) =>
                store.setStepAssessment(stepId, { ...assessment, note: e.target.value })
              }
              rows={2}
            />
          )}

          {flowTitles.length > 0 && (
            <button
              type="button"
              className="fq-linked-flows-btn"
              onClick={() => {
                const flow = bundle.flows.find((f) => flowTitles.includes(f.title));
                if (flow) store.toggleFlowExpanded(flow.id);
              }}
            >
              {flowTitles.length === 1 ? `View ${flowTitles[0]}` : `View ${flowTitles.length} linked flows`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
