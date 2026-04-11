export const SIDEBAR_CSS = `
:root {
  --fq-bg: #0f1419;
  --fq-panel: #151b23;
  --fq-border: #2d333b;
  --fq-text: #e6edf3;
  --fq-muted: #8b949e;
  --fq-accent: #58a6ff;
  --fq-warn: #d29922;
  --fq-danger: #f85149;
  --fq-ok: #3fb950;
  --fq-font: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  --fq-radius: 8px;
}
* { box-sizing: border-box; }
.fq-root {
  font-family: var(--fq-font);
  font-size: 13px;
  line-height: 1.45;
  color: var(--fq-text);
  background: var(--fq-bg);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.fq-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--fq-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.fq-brand { font-weight: 700; letter-spacing: 0.02em; }
.fq-muted { color: var(--fq-muted); font-size: 12px; }
.fq-body { flex: 1; overflow: auto; padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 12px; }
.fq-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fq-muted); margin-bottom: 6px; }
.fq-card {
  background: var(--fq-panel);
  border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius);
  padding: 10px;
}
.fq-btn {
  appearance: none;
  border: 1px solid var(--fq-border);
  background: #21262d;
  color: var(--fq-text);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}
.fq-btn:hover { border-color: var(--fq-muted); }
.fq-btn-primary { background: #1f6feb; border-color: #1f6feb; }
.fq-btn-primary:hover { filter: brightness(1.05); }
.fq-row { display: flex; flex-wrap: wrap; gap: 6px; }
.fq-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--fq-border);
  font-size: 11px;
  color: var(--fq-muted);
}
.fq-chip-hot { border-color: var(--fq-warn); color: var(--fq-warn); }
.fq-list { display: flex; flex-direction: column; gap: 6px; }
.fq-flow-item {
  border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius);
  padding: 8px;
  cursor: pointer;
  background: #0d1117;
}
.fq-flow-item:hover { border-color: var(--fq-muted); }
.fq-flow-item-active { border-color: var(--fq-accent); }
.fq-step {
  border-left: 2px solid var(--fq-border);
  padding-left: 8px;
  margin-bottom: 8px;
}
.fq-step-done { border-left-color: var(--fq-ok); }
/* Checklist step styles */
.fq-checklist { display: flex; flex-direction: column; gap: 2px; }
.fq-check-step {
  display: flex; gap: 8px; padding: 8px; border-radius: 6px;
  cursor: pointer; transition: background 0.15s;
}
.fq-check-step:hover { background: rgba(255,255,255,0.03); }
.fq-check-step-active { background: rgba(88,166,255,0.08); border: 1px solid rgba(88,166,255,0.25); }
.fq-check-step-next { background: rgba(210,153,34,0.06); border: 1px solid rgba(210,153,34,0.2); }
.fq-check-box {
  flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px;
  border: 1.5px solid var(--fq-border); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s; background: transparent;
}
.fq-check-box:hover { border-color: var(--fq-accent); }
.fq-check-box-done { border-color: var(--fq-ok); background: var(--fq-ok); }
.fq-check-box-active { border-color: var(--fq-accent); box-shadow: 0 0 0 2px rgba(88,166,255,0.2); }
.fq-check-box-stale { border-color: var(--fq-warn); background: rgba(210,153,34,0.15); box-shadow: 0 0 0 2px rgba(210,153,34,0.2); }
.fq-check-content { flex: 1; min-width: 0; }
.fq-check-instruction { font-size: 13px; line-height: 1.3; }
.fq-check-instruction-done { opacity: 0.45; }
.fq-check-meta { font-size: 11px; color: var(--fq-muted); margin-top: 2px; }
.fq-check-context { font-size: 12px; margin-top: 4px; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; }
.fq-progress-bar { height: 4px; border-radius: 2px; background: var(--fq-border); overflow: hidden; }
.fq-progress-fill { height: 100%; background: var(--fq-ok); border-radius: 2px; transition: width 0.3s ease; }
.fq-next-prompt {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.2);
  border-radius: 6px; font-size: 12px; cursor: pointer;
}
.fq-next-prompt:hover { background: rgba(210,153,34,0.12); }
.fq-flow-header-compact { margin-bottom: 8px; }
.fq-flow-header-compact h3 { margin: 0 0 2px; font-size: 15px; }
.fq-notes-toggle {
  font-size: 11px; color: var(--fq-muted); cursor: pointer;
  background: none; border: none; padding: 2px 0;
  opacity: 0; transition: opacity 0.15s;
}
.fq-check-step:hover .fq-notes-toggle,
.fq-check-step-active .fq-notes-toggle,
.fq-notes-toggle-has-note { opacity: 1; }
.fq-notes-toggle:hover { color: var(--fq-text); }
.fq-input, .fq-textarea, .fq-select {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--fq-border);
  background: #0d1117;
  color: var(--fq-text);
  padding: 6px 8px;
  font-size: 12px;
}
.fq-textarea { min-height: 72px; resize: vertical; }
.fq-label { display: block; font-size: 11px; color: var(--fq-muted); margin-bottom: 4px; }
.fq-type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.fq-type-btn {
  border: 1px solid var(--fq-border);
  background: #0d1117;
  color: var(--fq-text);
  border-radius: 6px;
  padding: 8px;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}
.fq-type-btn[data-active="true"] {
  border-color: var(--fq-accent);
  box-shadow: 0 0 0 1px var(--fq-accent);
}
.fq-banner {
  border: 1px dashed var(--fq-warn);
  color: var(--fq-warn);
  padding: 8px;
  border-radius: var(--fq-radius);
  font-size: 12px;
}
/* Strategy health bar */
.fq-strategy-bar {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 8px 10px; background: var(--fq-panel);
  border: 1px solid var(--fq-border); border-radius: var(--fq-radius);
}
.fq-strategy-bar .fq-strategy-title {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--fq-muted); width: 100%; margin-bottom: 2px;
}
.fq-stat {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--fq-muted);
}
.fq-stat-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.fq-dot-green { background: var(--fq-ok); }
.fq-dot-amber { background: var(--fq-warn); }
.fq-dot-red { background: var(--fq-danger); }
.fq-dot-muted { background: var(--fq-muted); opacity: 0.4; }
/* Segment picker */
.fq-segment-picker {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.fq-segment-btn {
  appearance: none; border: 1px solid var(--fq-border); background: transparent;
  color: var(--fq-muted); border-radius: 999px; padding: 2px 10px;
  font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.fq-segment-btn:hover { border-color: var(--fq-muted); color: var(--fq-text); }
.fq-segment-btn-active { border-color: var(--fq-accent); color: var(--fq-accent); background: rgba(88,166,255,0.08); }
/* Stale step indicator */
.fq-stale-badge {
  font-size: 10px; color: var(--fq-warn); margin-left: 6px;
}
.fq-collapse summary { cursor: pointer; color: var(--fq-muted); }
.fq-collapse .fq-card { margin-top: 8px; }
/* Flow dropdown in header */
.fq-flow-dropdown {
  flex: 1; min-width: 0; max-width: 220px;
  font-size: 12px; padding: 4px 6px;
  background: #0d1117; border: 1px solid var(--fq-border);
  color: var(--fq-text); border-radius: 6px;
  cursor: pointer; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238b949e'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  padding-right: 20px;
  text-overflow: ellipsis;
}
.fq-flow-dropdown:focus { border-color: var(--fq-accent); outline: none; }
/* What Changed section */
.fq-change-section { display: flex; flex-direction: column; gap: 4px; }
.fq-change-group {
  background: var(--fq-panel); border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius); overflow: hidden;
}
.fq-change-file {
  padding: 6px 10px; font-size: 11px; color: var(--fq-muted);
  background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--fq-border);
}
.fq-change-file code { color: var(--fq-text); font-size: 11px; }
.fq-change-step {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; cursor: pointer; font-size: 12px;
  transition: background 0.15s;
}
.fq-change-step:hover { background: rgba(255,255,255,0.03); }
.fq-change-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.fq-change-step-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Inline notes */
.fq-inline-note-area { margin-top: 2px; }
.fq-inline-note-preview {
  font-size: 11px; color: var(--fq-muted); cursor: pointer;
  padding: 2px 0; border-bottom: 1px dashed var(--fq-border);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fq-inline-note-preview:hover { color: var(--fq-text); }
.fq-inline-note-input { font-size: 12px; }
/* Sticky footer */
.fq-footer {
  padding: 8px 12px; border-top: 1px solid var(--fq-border);
  background: var(--fq-panel); flex-shrink: 0;
}
.fq-btn-copy {
  width: 100%; text-align: center; padding: 8px 12px;
  font-size: 13px; font-weight: 600;
  background: #1f6feb; border-color: #1f6feb; color: #fff;
}
.fq-btn-copy:hover { filter: brightness(1.1); }
.fq-btn-copy-done { background: var(--fq-ok); border-color: var(--fq-ok); }
/* Strategy intelligence */
.fq-strategy-section { display: flex; flex-direction: column; gap: 8px; }
.fq-signal {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 6px 8px; border-radius: 6px;
  font-size: 12px; background: var(--fq-panel);
  border: 1px solid var(--fq-border);
}
.fq-signal-high { border-left: 3px solid var(--fq-danger); }
.fq-signal-medium { border-left: 3px solid var(--fq-warn); }
.fq-signal-low { border-left: 3px solid var(--fq-muted); }
.fq-signal-dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0; margin-top: 5px;
}
.fq-signal-content { flex: 1; min-width: 0; }
.fq-signal-title { font-weight: 600; font-size: 12px; }
.fq-signal-detail { color: var(--fq-muted); font-size: 11px; margin-top: 1px; }
/* Assumption health */
.fq-assumption-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.fq-assumption {
  padding: 6px 8px; border-radius: 6px;
  background: var(--fq-panel); border: 1px solid var(--fq-border);
}
.fq-assumption-at_risk { border-left: 3px solid var(--fq-danger); }
.fq-assumption-mixed { border-left: 3px solid var(--fq-warn); }
.fq-assumption-confirmed { border-left: 3px solid var(--fq-ok); }
.fq-assumption-untested { border-left: 3px solid var(--fq-border); }
.fq-assumption-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 2px;
}
.fq-assumption-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
  padding: 1px 6px; border-radius: 3px; text-transform: uppercase;
}
.fq-badge-at_risk { background: rgba(248,81,73,0.15); color: var(--fq-danger); }
.fq-badge-mixed { background: rgba(210,153,34,0.15); color: var(--fq-warn); }
.fq-badge-confirmed { background: rgba(63,185,80,0.15); color: var(--fq-ok); }
.fq-badge-untested { background: rgba(139,148,158,0.1); color: var(--fq-muted); }
.fq-assumption-counts { font-size: 10px; color: var(--fq-muted); }
.fq-assumption-text { font-size: 12px; line-height: 1.35; }
/* Session / dwell tracking */
.fq-dwell-label {
  font-size: 10px; color: var(--fq-muted); margin-left: 6px;
  opacity: 0.7;
}
.fq-session-complete {
  padding: 6px 10px; border-radius: 6px; font-size: 12px;
  background: rgba(63,185,80,0.08); border: 1px solid rgba(63,185,80,0.2);
  color: var(--fq-ok); text-align: center;
}
`;
