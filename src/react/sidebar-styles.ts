export const SIDEBAR_CSS = `
:host {
  /* ── Identity: warm coral accent on deep neutral dark ── */
  --fq-bg: #111015;
  --fq-panel: #1A1921;
  --fq-surface: #22212B;
  --fq-border: #2E2D3A;
  --fq-border-subtle: #242330;
  --fq-text: #ECEAF2;
  --fq-muted: #8A87A0;
  --fq-accent: #FF6B5E;
  --fq-accent-soft: rgba(255,107,94,0.12);
  --fq-accent-hover: #FF8577;
  --fq-warn: #F0AD4E;
  --fq-danger: #FF5252;
  --fq-ok: #4ADE80;
  --fq-here: #818CF8;
  --fq-font: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --fq-radius: 10px;
  --fq-radius-sm: 6px;
  --fq-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3);
  --fq-shadow-sm: 0 2px 6px rgba(0,0,0,0.25);
  --fq-shadow-glow: 0 0 20px rgba(255,107,94,0.08);
}
* { box-sizing: border-box; }

/* ── Root ── */
.fq-root {
  font-family: var(--fq-font);
  font-size: 13px;
  line-height: 1.45;
  color: var(--fq-text);
  background: var(--fq-bg);
  background-image: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,107,94,0.03) 0%, transparent 60%);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

/* ── Header — frosted glass with accent edge ── */
.fq-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--fq-border);
  background: linear-gradient(180deg, rgba(34,33,43,0.98) 0%, rgba(17,16,21,0.99) 100%);
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  position: relative;
}
.fq-header::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--fq-accent) 0%, rgba(255,107,94,0.3) 40%, transparent 70%);
  opacity: 0.7;
}
.fq-brand {
  font-weight: 800;
  font-size: 15px;
  letter-spacing: -0.02em;
  color: var(--fq-accent);
  text-shadow: 0 0 20px rgba(255,107,94,0.3);
}
.fq-muted { color: var(--fq-muted); font-size: 12px; }

/* ── Body ── */
.fq-body {
  flex: 1; overflow: auto; padding: 12px 14px 16px;
  display: flex; flex-direction: column; gap: 14px;
}
/* Custom scrollbar */
.fq-body::-webkit-scrollbar { width: 6px; }
.fq-body::-webkit-scrollbar-track { background: transparent; }
.fq-body::-webkit-scrollbar-thumb { background: var(--fq-border); border-radius: 3px; }
.fq-body::-webkit-scrollbar-thumb:hover { background: var(--fq-muted); }

/* ── Section titles ── */
.fq-section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--fq-muted); margin-bottom: 6px; font-weight: 600; }
.fq-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--fq-muted); margin-bottom: 4px; font-weight: 600; }

/* ── Cards — elevated with layered shadow ── */
.fq-card {
  background: var(--fq-panel);
  border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius);
  padding: 10px;
  box-shadow: var(--fq-shadow), inset 0 1px 0 rgba(255,255,255,0.03);
}

/* ── Buttons ── */
.fq-btn {
  appearance: none;
  border: 1px solid var(--fq-border);
  background: var(--fq-surface);
  color: var(--fq-text);
  border-radius: var(--fq-radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}
.fq-btn:hover { border-color: var(--fq-muted); transform: translateY(-1px); box-shadow: var(--fq-shadow-sm); }
.fq-btn:active { transform: translateY(0); }
.fq-btn-primary { background: var(--fq-accent); border-color: var(--fq-accent); color: #fff; }
.fq-btn-primary:hover { background: var(--fq-accent-hover); border-color: var(--fq-accent-hover); }
.fq-row { display: flex; flex-wrap: wrap; gap: 6px; }

/* ── Chips ── */
.fq-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--fq-border);
  font-size: 11px;
  color: var(--fq-muted);
  font-weight: 500;
}
.fq-chip-hot { border-color: var(--fq-warn); color: var(--fq-warn); }
.fq-list { display: flex; flex-direction: column; gap: 6px; }

/* ── Flow items ── */
.fq-flow-item {
  border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius);
  padding: 8px;
  cursor: pointer;
  background: var(--fq-bg);
  transition: all 0.15s;
}
.fq-flow-item:hover { border-color: var(--fq-muted); box-shadow: var(--fq-shadow-sm); }
.fq-flow-item-active { border-color: var(--fq-accent); box-shadow: 0 0 0 1px var(--fq-accent); }

/* ── Checklist steps ── */
.fq-checklist { display: flex; flex-direction: column; gap: 0; }
.fq-check-step {
  display: flex; gap: 8px; padding: 6px 8px; border-radius: var(--fq-radius-sm);
  cursor: pointer; transition: all 0.15s;
  border: 1px solid transparent;
}
.fq-check-step:hover { background: rgba(255,255,255,0.02); }
.fq-check-step-active {
  background: linear-gradient(135deg, rgba(129,140,248,0.06) 0%, rgba(129,140,248,0.02) 100%);
  border-color: rgba(129,140,248,0.25);
  box-shadow: 0 0 12px rgba(129,140,248,0.05);
}
.fq-check-step-next {
  background: linear-gradient(135deg, rgba(255,107,94,0.06) 0%, transparent 100%);
  border-color: rgba(255,107,94,0.2);
  border-style: dashed;
}

/* ── Checkboxes ── */
.fq-check-box {
  flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px;
  border: 1.5px solid var(--fq-border); border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; background: transparent;
}
.fq-check-box:hover { border-color: var(--fq-accent); box-shadow: 0 0 0 2px var(--fq-accent-soft); }
.fq-check-box-done { border-color: var(--fq-muted); background: rgba(138,135,160,0.3); color: var(--fq-muted); }
.fq-check-box-active { border-color: var(--fq-accent); box-shadow: 0 0 0 2px var(--fq-accent-soft); }
.fq-check-box-stale { border-color: var(--fq-warn); background: rgba(240,173,78,0.1); }
.fq-check-content { flex: 1; min-width: 0; }
.fq-check-instruction { font-size: 13px; line-height: 1.3; }
.fq-check-instruction-done { opacity: 0.4; }
.fq-check-meta { font-size: 11px; color: var(--fq-muted); margin-top: 2px; }
.fq-check-instruction-clickable { cursor: pointer; }
.fq-check-instruction-clickable:hover { color: var(--fq-accent); }
.fq-context-hint {
  font-size: 10px; color: var(--fq-muted); margin-left: 4px;
  opacity: 0; transition: opacity 0.15s;
}
.fq-check-step:hover .fq-context-hint { opacity: 0.6; }
.fq-check-context {
  font-size: 12px; margin-top: 4px; padding: 6px 8px;
  background: rgba(255,255,255,0.02); border-radius: var(--fq-radius-sm);
  border: 1px solid var(--fq-border-subtle);
  display: flex; flex-direction: column; gap: 3px;
}
.fq-context-line { line-height: 1.35; }

/* ── Slim flow card ── */
.fq-flow-card {
  padding: 8px 10px; border-radius: var(--fq-radius);
  border: 1px solid var(--fq-border);
  background: var(--fq-panel);
  box-shadow: var(--fq-shadow-sm);
  display: flex; flex-direction: column; gap: 0;
}
.fq-flow-card-top {
  display: flex; align-items: center; gap: 6px;
}
.fq-flow-card-count {
  font-size: 11px; color: var(--fq-muted); white-space: nowrap;
  font-variant-numeric: tabular-nums; font-weight: 600; flex-shrink: 0;
}
.fq-flow-card-info {
  appearance: none; background: none; border: 1px solid transparent;
  color: var(--fq-muted); cursor: pointer; padding: 2px 4px;
  border-radius: var(--fq-radius-sm); transition: all 0.15s;
  font-size: 13px; line-height: 1; flex-shrink: 0;
}
.fq-flow-card-info:hover { color: var(--fq-text); border-color: var(--fq-border); }
.fq-flow-card-info-active { color: var(--fq-here); }
.fq-flow-card-intent {
  font-size: 11px; color: var(--fq-muted); line-height: 1.35;
  margin-top: 6px; padding-top: 6px;
  border-top: 1px solid var(--fq-border-subtle);
  font-style: italic; opacity: 0.8;
}
.fq-flow-card-next {
  display: flex; align-items: center; gap: 8px;
  margin-top: 6px; padding-top: 6px;
  border-top: 1px solid var(--fq-border-subtle);
  font-size: 12px;
}
.fq-flow-card-next-label {
  color: var(--fq-accent); font-weight: 700; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0;
}
.fq-flow-card-next-text { flex: 1; min-width: 0; }
.fq-flow-card-next-link { cursor: pointer; border-radius: var(--fq-radius-sm); padding: 2px 4px; margin: -2px -4px; }
.fq-flow-card-next-link:hover { background: rgba(255,107,94,0.06); }
.fq-flow-card-next-link:hover .fq-flow-card-next-text { color: var(--fq-accent); }
.fq-flow-card-next-arrow {
  color: var(--fq-accent); font-size: 14px; flex-shrink: 0;
  opacity: 0; transition: opacity 0.15s;
}
.fq-flow-card-next-link:hover .fq-flow-card-next-arrow { opacity: 1; }

/* ── Flow header ── */
.fq-flow-header-compact { margin-bottom: 8px; }
.fq-flow-header-compact h3 { margin: 0 0 2px; font-size: 15px; font-weight: 600; }

/* ── Notes ── */
.fq-notes-toggle {
  font-size: 11px; color: var(--fq-muted); cursor: pointer;
  background: none; border: none; padding: 2px 0;
  opacity: 0.5; transition: opacity 0.15s;
}
.fq-check-step:hover .fq-notes-toggle,
.fq-check-step-active .fq-notes-toggle,
.fq-notes-toggle-has-note { opacity: 1; }
.fq-notes-toggle:hover { color: var(--fq-accent); opacity: 1; }

/* ── Form inputs ── */
.fq-input, .fq-textarea, .fq-select {
  width: 100%;
  border-radius: var(--fq-radius-sm);
  border: 1px solid var(--fq-border);
  background: var(--fq-bg);
  color: var(--fq-text);
  padding: 6px 10px;
  font-size: 12px;
  transition: border-color 0.15s;
}
.fq-input:focus, .fq-textarea:focus, .fq-select:focus {
  border-color: var(--fq-accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--fq-accent-soft);
}
.fq-textarea { min-height: 72px; resize: vertical; }
.fq-label { display: block; font-size: 11px; color: var(--fq-muted); margin-bottom: 4px; font-weight: 500; }

/* ── Issue type grid ── */
.fq-type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.fq-type-btn {
  border: 1px solid var(--fq-border);
  background: var(--fq-bg);
  color: var(--fq-text);
  border-radius: var(--fq-radius-sm);
  padding: 8px;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  font-weight: 500;
}
.fq-type-btn:hover { border-color: var(--fq-muted); }
.fq-type-btn[data-active="true"] {
  border-color: var(--fq-accent);
  background: var(--fq-accent-soft);
  box-shadow: 0 0 0 1px var(--fq-accent);
}

/* ── Banner ── */
.fq-banner {
  border: 1px dashed var(--fq-warn);
  color: var(--fq-warn);
  padding: 8px 12px;
  border-radius: var(--fq-radius);
  font-size: 12px;
  background: rgba(240,173,78,0.04);
}

/* ── Strategy health bar ── */
.fq-strategy-bar {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 8px 10px; background: var(--fq-panel);
  border: 1px solid var(--fq-border); border-radius: var(--fq-radius);
  box-shadow: var(--fq-shadow-sm);
}
.fq-strategy-bar .fq-strategy-title {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--fq-muted); width: 100%; margin-bottom: 2px; font-weight: 600;
}
.fq-stat {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--fq-muted);
}
.fq-stat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.fq-dot-green { background: var(--fq-ok); box-shadow: 0 0 4px rgba(74,222,128,0.4); }
.fq-dot-amber { background: var(--fq-warn); box-shadow: 0 0 4px rgba(240,173,78,0.4); }
.fq-dot-red { background: var(--fq-danger); box-shadow: 0 0 4px rgba(255,82,82,0.4); }
.fq-dot-muted { background: var(--fq-muted); opacity: 0.4; }

/* ── Segment picker ── */
.fq-segment-picker { display: flex; gap: 4px; flex-wrap: wrap; }
.fq-segment-btn {
  appearance: none; border: 1px solid var(--fq-border); background: transparent;
  color: var(--fq-muted); border-radius: 999px; padding: 3px 12px;
  font-size: 11px; cursor: pointer; transition: all 0.15s; font-weight: 500;
}
.fq-segment-btn:hover { border-color: var(--fq-muted); color: var(--fq-text); }
.fq-segment-btn-active {
  border-color: var(--fq-accent); color: var(--fq-accent);
  background: var(--fq-accent-soft);
  box-shadow: 0 0 8px rgba(255,107,94,0.15);
}
.fq-segment-pct { font-size: 9px; color: var(--fq-muted); margin-left: 3px; }

/* ── Stale badge ── */
.fq-stale-badge { font-size: 10px; color: var(--fq-warn); margin-left: 6px; }


/* ── Segment dropdown (header) ── */
.fq-segment-dropdown {
  width: auto; min-width: 0; max-width: 140px;
  font-size: 11px; padding: 3px 22px 3px 8px;
  background: var(--fq-surface); border: 1px solid var(--fq-border);
  color: var(--fq-muted); border-radius: var(--fq-radius-sm);
  cursor: pointer; appearance: none; font-weight: 500;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238A87A0'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  text-overflow: ellipsis;
  transition: all 0.15s;
}
.fq-segment-dropdown:focus { border-color: var(--fq-accent); outline: none; }
.fq-segment-dropdown:hover { border-color: var(--fq-muted); color: var(--fq-text); }

/* ── Flow selector (standalone, when no flow active) ── */
.fq-flow-selector {
  display: flex; align-items: center; gap: 8px;
}

/* ── Flow dropdown ── */
.fq-flow-dropdown {
  flex: 1; min-width: 0;
  font-size: 13px; padding: 6px 10px;
  background: var(--fq-bg); border: 1px solid var(--fq-border);
  color: var(--fq-text); border-radius: var(--fq-radius-sm);
  cursor: pointer; appearance: none; font-weight: 600;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238A87A0'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 22px;
  text-overflow: ellipsis;
  transition: border-color 0.15s;
}
.fq-flow-dropdown:focus { border-color: var(--fq-accent); outline: none; box-shadow: 0 0 0 2px var(--fq-accent-soft); }

/* ── What Changed ── */
.fq-change-section { display: flex; flex-direction: column; gap: 4px; }
.fq-change-group {
  background: var(--fq-panel); border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius); overflow: hidden;
  box-shadow: var(--fq-shadow-sm);
}
.fq-change-file {
  padding: 6px 10px; font-size: 11px; color: var(--fq-muted);
  background: rgba(255,255,255,0.015); border-bottom: 1px solid var(--fq-border-subtle);
}
.fq-change-file code { color: var(--fq-text); font-size: 11px; font-weight: 500; }
.fq-change-step {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; cursor: pointer; font-size: 12px;
  transition: all 0.15s;
}
.fq-change-step:hover { background: rgba(255,255,255,0.02); }
.fq-change-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.fq-change-step-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Inline notes ── */
.fq-inline-note-area { margin-top: 2px; }
.fq-inline-note-preview {
  font-size: 11px; color: var(--fq-muted); cursor: pointer;
  padding: 2px 0; border-bottom: 1px dashed var(--fq-border);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fq-inline-note-preview:hover { color: var(--fq-text); }
.fq-inline-note-input { font-size: 12px; }

/* ── Sticky footer ── */
.fq-footer {
  padding: 8px 14px; border-top: 1px solid var(--fq-border);
  background: var(--fq-bg);
  flex-shrink: 0;
}
/* Subtle copy button — demoted from primary CTA */
.fq-btn-copy-subtle {
  width: 100%; text-align: center; padding: 8px 14px;
  font-size: 12px; font-weight: 600; letter-spacing: 0.01em;
  background: var(--fq-surface);
  border: 1px solid var(--fq-border); color: var(--fq-muted);
  border-radius: var(--fq-radius);
  transition: all 0.2s; cursor: pointer;
}
.fq-btn-copy-subtle:hover {
  color: var(--fq-text); border-color: var(--fq-muted);
  transform: translateY(-1px); box-shadow: var(--fq-shadow-sm);
}
.fq-btn-copy-subtle:active { transform: translateY(0); }
.fq-btn-copy-subtle.fq-btn-copy-done { border-color: var(--fq-ok); color: var(--fq-ok); background: rgba(74,222,128,0.06); }

/* ── Alerts ── */
.fq-alerts { display: flex; flex-direction: column; gap: 4px; }
.fq-alert {
  display: flex; gap: 6px; align-items: baseline;
  padding: 6px 10px; border-radius: var(--fq-radius-sm);
  font-size: 12px; line-height: 1.35;
}
.fq-alert-high { background: rgba(255,82,82,0.06); border-left: 3px solid var(--fq-danger); }
.fq-alert-medium { background: rgba(240,173,78,0.05); border-left: 3px solid var(--fq-warn); }
.fq-alert-title { font-weight: 600; white-space: nowrap; flex-shrink: 0; }
.fq-alert-detail { color: var(--fq-muted); font-size: 11px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

/* ── Assumption health ── */
.fq-assumption-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.fq-assumption {
  padding: 6px 8px; border-radius: var(--fq-radius-sm);
  background: var(--fq-panel); border: 1px solid var(--fq-border);
}
.fq-assumption-at_risk { border-left: 3px solid var(--fq-danger); }
.fq-assumption-mixed { border-left: 3px solid var(--fq-warn); }
.fq-assumption-confirmed { border-left: 3px solid var(--fq-ok); }
.fq-assumption-untested { border-left: 3px solid var(--fq-border); }
.fq-assumption-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.fq-assumption-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
  padding: 1px 6px; border-radius: 3px; text-transform: uppercase;
}
.fq-badge-at_risk { background: rgba(255,82,82,0.15); color: var(--fq-danger); }
.fq-badge-mixed { background: rgba(240,173,78,0.15); color: var(--fq-warn); }
.fq-badge-confirmed { background: rgba(74,222,128,0.15); color: var(--fq-ok); }
.fq-badge-untested { background: rgba(138,135,160,0.1); color: var(--fq-muted); }
.fq-assumption-counts { font-size: 10px; color: var(--fq-muted); }
.fq-assumption-text { font-size: 12px; line-height: 1.35; }

/* ── Session tracking ── */
.fq-dwell-label { font-size: 10px; color: var(--fq-muted); margin-left: 6px; opacity: 0.7; }
.fq-session-complete {
  padding: 14px 16px; border-radius: var(--fq-radius);
  background: linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(74,222,128,0.03) 100%);
  border: 1px solid rgba(74,222,128,0.2);
  color: var(--fq-ok); text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  box-shadow: 0 0 16px rgba(74,222,128,0.06);
}
.fq-complete-icon {
  font-size: 20px; font-weight: 700;
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(74,222,128,0.15); display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 12px rgba(74,222,128,0.2);
  margin-bottom: 2px;
}
.fq-complete-title { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
.fq-complete-detail { font-size: 11px; color: var(--fq-muted); }

/* ── All caught up ── */
.fq-all-clear {
  padding: 20px 16px; border-radius: var(--fq-radius);
  background: linear-gradient(135deg, rgba(74,222,128,0.06) 0%, rgba(129,140,248,0.04) 100%);
  border: 1px solid rgba(74,222,128,0.15);
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  box-shadow: var(--fq-shadow-sm);
}
.fq-all-clear-icon {
  font-size: 22px; font-weight: 700; color: var(--fq-ok);
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(74,222,128,0.12); display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 16px rgba(74,222,128,0.15);
  margin-bottom: 4px;
}
.fq-all-clear-title { font-size: 15px; font-weight: 700; color: var(--fq-ok); letter-spacing: -0.01em; }
.fq-all-clear-detail { font-size: 12px; color: var(--fq-muted); }

/* ── Collapsible sections — styled disclosure ── */
.fq-collapse { border-radius: var(--fq-radius-sm); }
.fq-collapse summary {
  cursor: pointer; color: var(--fq-muted); font-weight: 600; font-size: 12px;
  transition: color 0.15s;
  list-style: none;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 0;
}
.fq-collapse summary::-webkit-details-marker { display: none; }
.fq-collapse summary::before {
  content: '›';
  display: inline-block; font-size: 14px; font-weight: 700;
  transition: transform 0.2s;
  color: var(--fq-accent);
  width: 12px; text-align: center; flex-shrink: 0;
}
.fq-collapse[open] > summary::before { transform: rotate(90deg); }
.fq-collapse summary:hover { color: var(--fq-text); }
.fq-collapse .fq-card { margin-top: 8px; }

/* ── Insights label + count ── */
.fq-insights-label { color: var(--fq-here); font-weight: 700; }
.fq-insights-count {
  font-size: 10px; font-weight: 700; color: var(--fq-here);
  background: rgba(129,140,248,0.12); border-radius: 999px;
  padding: 0 6px; min-width: 18px; text-align: center;
}

/* ── Observation insight cards ── */
.fq-observation-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.fq-observation-card {
  padding: 7px 10px; border-radius: var(--fq-radius-sm);
  background: var(--fq-panel); border: 1px solid var(--fq-border);
  border-left: 2px solid var(--fq-muted);
  font-size: 12px; line-height: 1.4; color: var(--fq-text);
  transition: all 0.15s;
}
.fq-observation-card:hover { background: rgba(255,255,255,0.02); }
/* Type-specific left borders */
.fq-observation-card[data-type="risk"] { border-left-color: var(--fq-warn); }
.fq-observation-card[data-type="gap"] { border-left-color: var(--fq-danger); }
.fq-observation-card[data-type="opportunity"] { border-left-color: var(--fq-here); }
.fq-observation-card[data-type="info"] { border-left-color: var(--fq-muted); }
.fq-observation-card-type {
  font-size: 10px; font-weight: 600; color: var(--fq-muted);
  margin-bottom: 2px;
}
.fq-observation-card-text { color: var(--fq-text); font-size: 12px; }
.fq-observation-card-assumption {
  margin-top: 4px; padding-top: 4px;
  border-top: 1px solid var(--fq-border-subtle);
  font-size: 11px; color: var(--fq-muted); font-style: italic;
}
/* "Show N more" link */
.fq-show-all-insights {
  appearance: none; background: none; border: none;
  color: var(--fq-muted); font-size: 11px; font-weight: 500;
  cursor: pointer; padding: 4px 0; text-align: center;
  transition: color 0.15s;
}
.fq-show-all-insights:hover { color: var(--fq-here); }
/* Compact observation teasers (inline in flow, above steps) */
.fq-observation-teaser {
  padding: 8px 10px; border-radius: var(--fq-radius-sm);
  background: rgba(129,140,248,0.04); border: 1px solid rgba(129,140,248,0.12);
  font-size: 12px; line-height: 1.4; color: var(--fq-muted);
  border-left: 2px solid rgba(129,140,248,0.3);
  transition: all 0.15s;
}
.fq-observation-teaser:hover { color: var(--fq-text); border-color: rgba(129,140,248,0.3); background: rgba(129,140,248,0.06); }

/* ── Divider ── */
.fq-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--fq-border), transparent);
  margin: 4px 0;
}

/* ── Inline issue input ── */
.fq-issue-inline {
  border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius);
  background: var(--fq-panel);
  overflow: hidden;
  transition: all 0.2s;
  box-shadow: var(--fq-shadow-sm);
}
.fq-issue-inline:focus-within {
  border-color: var(--fq-accent);
  box-shadow: 0 0 0 2px var(--fq-accent-soft);
}
.fq-issue-inline-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px 0;
}
.fq-issue-inline-label {
  font-size: 9px; font-weight: 800; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--fq-accent);
}
.fq-issue-inline-step {
  font-size: 10px; color: var(--fq-muted); font-weight: 500;
}
.fq-issue-inline-input {
  width: 100%; border: none; background: transparent;
  color: var(--fq-text); font-size: 12px; font-family: var(--fq-font);
  padding: 6px 12px 10px; resize: none; outline: none;
  line-height: 1.4; transition: all 0.15s;
}
.fq-issue-inline-input::placeholder { color: var(--fq-muted); }
.fq-issue-inline-fields {
  padding: 0 12px 10px;
  display: flex; flex-direction: column; gap: 8px;
  border-top: 1px solid var(--fq-border-subtle);
  padding-top: 8px;
}
.fq-issue-inline-assumption {
  font-size: 11px; padding: 5px 8px;
  background: rgba(240,173,78,0.06); border-radius: var(--fq-radius-sm);
}
.fq-issue-inline-row {
  display: flex; gap: 6px; align-items: center;
}
.fq-issue-select {
  width: auto; flex: 1; min-width: 0;
  font-size: 11px; padding: 4px 22px 4px 8px;
  background: var(--fq-bg); border: 1px solid var(--fq-border);
  color: var(--fq-text); border-radius: var(--fq-radius-sm);
  cursor: pointer; appearance: none; font-weight: 500;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238A87A0'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  transition: border-color 0.15s;
}
.fq-issue-select:focus { border-color: var(--fq-accent); outline: none; }
.fq-issue-inline-actions {
  display: flex; gap: 6px;
}
.fq-chip-btn {
  appearance: none; border: 1px solid var(--fq-border); background: transparent;
  color: var(--fq-muted); border-radius: 999px; padding: 2px 10px;
  font-size: 10px; cursor: pointer; transition: all 0.15s; font-weight: 600;
}
.fq-chip-btn:hover { border-color: var(--fq-muted); color: var(--fq-text); }
.fq-chip-btn[data-active="true"] {
  border-color: var(--fq-accent); color: var(--fq-accent);
  background: var(--fq-accent-soft);
}

/* ── Observation scope picker ── */
.fq-obs-scope-picker {
  display: flex; gap: 4px; margin-bottom: 8px;
}
.fq-obs-scope-btn {
  appearance: none; border: 1px solid var(--fq-border); background: transparent;
  color: var(--fq-muted); border-radius: 999px; padding: 2px 10px;
  font-size: 10px; cursor: pointer; transition: all 0.15s; font-weight: 500;
}
.fq-obs-scope-btn:hover { border-color: var(--fq-muted); color: var(--fq-text); }
.fq-obs-scope-btn-active {
  border-color: var(--fq-here); color: var(--fq-here);
  background: rgba(129,140,248,0.1);
}

/* ── Gear button ── */
.fq-gear-btn {
  appearance: none; background: none; border: 1px solid transparent;
  color: var(--fq-muted); cursor: pointer; padding: 4px;
  border-radius: var(--fq-radius-sm); transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; line-height: 1;
}
.fq-gear-btn:hover { color: var(--fq-text); border-color: var(--fq-border); background: var(--fq-surface); }

/* ── Tools dropdown — anchored to gear button ── */
.fq-tools-backdrop {
  position: fixed; inset: 0; z-index: 90;
  background: transparent;
}
.fq-tools-panel {
  position: absolute; top: 52px; right: 12px; z-index: 100;
  width: 240px;
  background: var(--fq-panel);
  border: 1px solid var(--fq-border); border-radius: var(--fq-radius);
  box-shadow: var(--fq-shadow), 0 8px 24px rgba(0,0,0,0.45);
  padding: 12px;
  display: flex; flex-direction: column; gap: 12px;
  animation: fq-slide-in 0.15s ease both;
}
.fq-tools-panel-header {
  display: flex; justify-content: space-between; align-items: center;
}
.fq-tools-panel-title {
  font-size: 13px; font-weight: 700; color: var(--fq-text);
}
.fq-tools-panel-section { display: flex; flex-direction: column; gap: 6px; }
.fq-tools-panel-label {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--fq-muted); font-weight: 600;
}

/* ── Other flows hint ── */
.fq-other-flows-hint {
  font-size: 10px; color: var(--fq-muted);
  text-align: center; font-weight: 500;
  padding: 2px 0;
  opacity: 0.7;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRIORITY FLOW LIST
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-priority-flows { display: flex; flex-direction: column; gap: 8px; }
.fq-priority-flow {
  padding: 12px 14px; border-radius: var(--fq-radius);
  border: 1px solid var(--fq-border);
  background: linear-gradient(145deg, var(--fq-panel) 0%, rgba(34,33,43,0.7) 100%);
  cursor: pointer; transition: all 0.2s;
  box-shadow: var(--fq-shadow), inset 0 1px 0 rgba(255,255,255,0.04);
  position: relative;
  overflow: hidden;
}
.fq-priority-flow::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
}
.fq-priority-flow:hover {
  border-color: var(--fq-accent);
  transform: translateY(-2px);
  box-shadow: var(--fq-shadow), 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,107,94,0.15);
}
.fq-priority-flow:active { transform: translateY(0); }
.fq-priority-flow-here {
  border-color: rgba(129,140,248,0.35);
  background: linear-gradient(145deg, rgba(129,140,248,0.08) 0%, var(--fq-panel) 100%);
  box-shadow: var(--fq-shadow), 0 0 16px rgba(129,140,248,0.06);
}
.fq-priority-flow-here::before {
  background: linear-gradient(90deg, transparent, rgba(129,140,248,0.15), transparent);
}
.fq-priority-flow-here:hover {
  border-color: var(--fq-here);
  box-shadow: var(--fq-shadow), 0 8px 24px rgba(0,0,0,0.3), 0 0 16px rgba(129,140,248,0.1);
}
.fq-priority-flow-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.fq-priority-flow-title { font-size: 13px; font-weight: 600; flex: 1; min-width: 0; letter-spacing: -0.01em; }
.fq-priority-flow-count {
  font-size: 12px; color: var(--fq-muted); flex-shrink: 0; margin-left: 8px;
  font-variant-numeric: tabular-nums; font-weight: 600;
}
.fq-priority-flow-bar {
  height: 4px; border-radius: 2px;
  background: var(--fq-border);
  overflow: hidden; margin-bottom: 10px;
}
.fq-priority-flow-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, var(--fq-ok), #6EE7B7);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 10px rgba(74,222,128,0.4), 0 0 3px rgba(74,222,128,0.6);
}
.fq-priority-flow-fill-empty { background: transparent; width: 0 !important; box-shadow: none; }
.fq-priority-flow-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.fq-pf-chip {
  display: inline-flex; align-items: center;
  padding: 2px 9px; border-radius: 999px;
  font-size: 10px; font-weight: 600; white-space: nowrap;
  letter-spacing: 0.02em;
  border: 1px solid transparent;
}
.fq-pf-chip-changed { background: rgba(240,173,78,0.12); color: var(--fq-warn); border-color: rgba(240,173,78,0.2); }
.fq-pf-chip-issues { background: rgba(255,82,82,0.1); color: var(--fq-danger); border-color: rgba(255,82,82,0.18); }
.fq-pf-chip-here { background: rgba(129,140,248,0.12); color: var(--fq-here); border-color: rgba(129,140,248,0.2); }

/* ═══════════════════════════════════════════════════════════════════════════
   PROVOCATIONS (kept for future use)
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-provocations { display: flex; flex-direction: column; gap: 6px; }
@keyframes fq-slide-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
.fq-provocation {
  position: relative;
  padding: 10px 28px 10px 12px; border-radius: var(--fq-radius);
  border: 1px solid var(--fq-border); background: var(--fq-panel);
  animation: fq-slide-in 0.2s ease both;
  transition: opacity 0.3s ease, transform 0.3s ease;
  box-shadow: var(--fq-shadow-sm);
}
.fq-provocation:nth-child(2) { animation-delay: 0.06s; }
.fq-provocation:nth-child(3) { animation-delay: 0.12s; }
.fq-provocation-critical { border-left: 3px solid var(--fq-danger); background: rgba(255,82,82,0.04); }
.fq-provocation-important { border-left: 3px solid var(--fq-warn); background: rgba(240,173,78,0.03); }
.fq-provocation-notable { border-left: 2px solid var(--fq-border); background: transparent; padding: 8px 28px 8px 10px; }
.fq-provocation-fade { opacity: 0; transform: translateX(20px); pointer-events: none; }
.fq-provocation-close {
  position: absolute; top: 6px; right: 6px;
  appearance: none; background: none; border: none;
  color: var(--fq-muted); font-size: 14px; line-height: 1;
  cursor: pointer; padding: 2px 4px; border-radius: 3px;
  opacity: 0; transition: opacity 0.15s, color 0.15s;
}
.fq-provocation:hover .fq-provocation-close { opacity: 1; }
.fq-provocation-close:hover { color: var(--fq-text); background: rgba(255,255,255,0.06); }
.fq-provocation-glyph { margin-right: 6px; font-size: 12px; }
.fq-provocation-critical .fq-provocation-glyph { color: var(--fq-danger); }
.fq-provocation-important .fq-provocation-glyph { color: var(--fq-warn); }
.fq-provocation-notable .fq-provocation-glyph { color: var(--fq-muted); }
.fq-provocation-thesis { font-size: 13px; line-height: 1.35; font-weight: 500; margin-bottom: 4px; }
.fq-provocation-notable .fq-provocation-thesis { font-weight: 400; font-size: 12px; }
.fq-provocation-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.fq-provocation-why { font-size: 11px; color: var(--fq-muted); }
.fq-provocation-notable .fq-provocation-meta { margin-bottom: 6px; }
.fq-provocation-chip {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0;
}
.fq-provocation-chip-value { font-variant-numeric: tabular-nums; }
.fq-provocation-chip-max { font-weight: 400; opacity: 0.7; }
.fq-provocation-chip-critical { background: rgba(255,82,82,0.15); color: var(--fq-danger); }
.fq-provocation-chip-important { background: rgba(240,173,78,0.15); color: var(--fq-warn); }
.fq-provocation-chip-notable { background: rgba(138,135,160,0.12); color: var(--fq-muted); }
.fq-provocation-chip-sm { padding: 1px 6px; font-size: 10px; }
.fq-provocation-options { display: flex; flex-wrap: wrap; gap: 6px; }
.fq-provocation-btn {
  appearance: none; border: 1px solid var(--fq-border); background: var(--fq-surface);
  color: var(--fq-text); border-radius: var(--fq-radius-sm); padding: 4px 10px;
  font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.fq-provocation-btn-primary { background: var(--fq-accent-soft); border-color: rgba(255,107,94,0.3); color: var(--fq-accent); font-weight: 500; }
.fq-provocation-btn-primary:hover { background: rgba(255,107,94,0.2); border-color: var(--fq-accent); }
.fq-provocation-btn-secondary { color: var(--fq-muted); }
.fq-provocation-btn-secondary:hover { border-color: var(--fq-muted); color: var(--fq-text); }
.fq-provocation-btn-copied { background: var(--fq-ok); border-color: var(--fq-ok); color: #fff; }
.fq-provocation-more {
  appearance: none; background: none; border: 1px dashed var(--fq-border);
  color: var(--fq-muted); border-radius: var(--fq-radius-sm); padding: 5px 10px;
  font-size: 11px; cursor: pointer; text-align: center; transition: all 0.15s;
}
.fq-provocation-more:hover { border-color: var(--fq-muted); color: var(--fq-text); }
.fq-provocation-teaser {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 10px; border-radius: var(--fq-radius-sm);
  font-size: 12px; color: var(--fq-muted);
  cursor: pointer; transition: all 0.15s;
  animation: fq-slide-in 0.2s ease both;
}
.fq-provocation-teaser:hover { background: rgba(255,255,255,0.03); color: var(--fq-text); }
.fq-provocation-teaser-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fq-provocation-teaser-arrow { flex-shrink: 0; font-size: 14px; opacity: 0.4; }

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE BAR
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-route-bar {
  padding: 6px 10px;
  background: var(--fq-panel);
  border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius-sm);
}
.fq-route-path {
  font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--fq-muted); font-weight: 500;
}
.fq-route-link {
  font-size: 10px; font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--fq-here); opacity: 0.6;
  transition: opacity 0.15s;
  margin-left: 4px; flex-shrink: 0;
}
.fq-change-step:hover .fq-route-link { opacity: 1; }

/* ═══════════════════════════════════════════════════════════════════════════
   MULTI-FLOW CARDS
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-flow-cards { display: flex; flex-direction: column; gap: 6px; }

/* Override the old .fq-flow-card for the new expandable card pattern */
.fq-flow-card {
  padding: 0; border-radius: var(--fq-radius);
  border: 1px solid var(--fq-border);
  background: var(--fq-panel);
  box-shadow: var(--fq-shadow-sm);
  display: flex; flex-direction: column; gap: 0;
  overflow: hidden;
}
.fq-flow-card-hot {
  border-left: 3px solid var(--fq-warn);
}
.fq-flow-card-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  cursor: pointer; transition: background 0.15s;
}
.fq-flow-card-header:hover { background: rgba(255,255,255,0.02); }
.fq-flow-card-title {
  flex: 1; min-width: 0; font-size: 13px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fq-flow-card-progress {
  font-size: 11px; color: var(--fq-muted); font-weight: 600;
  font-variant-numeric: tabular-nums; flex-shrink: 0;
}
.fq-chip-stale {
  border-color: var(--fq-warn); color: var(--fq-warn);
  font-size: 10px; padding: 1px 6px;
}
.fq-chevron {
  color: var(--fq-muted); font-size: 16px; font-weight: 700;
  transition: transform 0.2s; flex-shrink: 0;
}
.fq-chevron-open { transform: rotate(90deg); }

.fq-flow-card-body {
  padding: 0 12px 12px;
  border-top: 1px solid var(--fq-border-subtle);
  display: flex; flex-direction: column; gap: 0;
}
.fq-flow-card-intent {
  font-size: 11px; color: var(--fq-muted); line-height: 1.35;
  padding: 8px 0 4px; font-style: italic; opacity: 0.8;
}

/* ── Here dot (indigo) ── */
.fq-here-dot {
  display: inline-block; width: 6px; height: 6px;
  background: var(--fq-here); border-radius: 50%;
  margin-left: 6px; vertical-align: middle;
  box-shadow: 0 0 6px rgba(129,140,248,0.4);
}

/* ── Assessment indicator dots on step rows ── */
.fq-assess-indicator {
  display: inline-block; width: 6px; height: 6px;
  border-radius: 50%; margin-left: 6px; vertical-align: middle;
}
.fq-assess-good { background: var(--fq-ok); }
.fq-assess-work { background: var(--fq-warn); }

/* ═══════════════════════════════════════════════════════════════════════════
   STEP ASSESSMENT PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-step-assess {
  margin-top: 4px; padding: 8px 10px;
  background: rgba(255,255,255,0.02); border-radius: var(--fq-radius-sm);
  border: 1px solid var(--fq-border-subtle);
  display: flex; flex-direction: column; gap: 6px;
}
.fq-criteria-row {
  display: flex; gap: 6px; align-items: flex-start;
  font-size: 12px; line-height: 1.35;
}
.fq-criteria-text {
  flex: 1; min-width: 0;
  color: var(--fq-text); font-size: 12px; line-height: 1.35;
}
.fq-assess-row {
  display: flex; gap: 6px; margin-top: 2px;
}
.fq-assess-btn {
  appearance: none; border: 1px solid var(--fq-border);
  background: transparent; color: var(--fq-muted);
  border-radius: var(--fq-radius-sm);
  padding: 4px 12px; font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.fq-assess-btn:hover { border-color: var(--fq-muted); color: var(--fq-text); }
.fq-assess-btn-good.fq-assess-active {
  border-color: var(--fq-ok); color: var(--fq-ok);
  background: rgba(74,222,128,0.08);
}
.fq-assess-btn-work.fq-assess-active {
  border-color: var(--fq-warn); color: var(--fq-warn);
  background: rgba(240,173,78,0.08);
}
.fq-assess-note {
  width: 100%; border: 1px solid var(--fq-border);
  background: var(--fq-bg); color: var(--fq-text);
  border-radius: var(--fq-radius-sm);
  padding: 6px 8px; font-size: 11px;
  font-family: var(--fq-font);
  resize: vertical; min-height: 40px;
  transition: border-color 0.15s;
}
.fq-assess-note:focus {
  border-color: var(--fq-accent); outline: none;
  box-shadow: 0 0 0 2px var(--fq-accent-soft);
}
.fq-assess-note::placeholder { color: var(--fq-muted); }

/* ═══════════════════════════════════════════════════════════════════════════
   OTHER FLOWS (compact list)
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-other-flows { margin-top: 4px; }
.fq-other-flow-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: var(--fq-radius-sm);
  cursor: pointer; transition: all 0.15s;
  font-size: 12px;
}
.fq-other-flow-item:hover { background: rgba(255,255,255,0.03); }
.fq-other-flow-title {
  flex: 1; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
  color: var(--fq-muted);
}
.fq-other-flow-item:hover .fq-other-flow-title { color: var(--fq-text); }

/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHTS SECTION (inline)
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-insights-section { display: flex; flex-direction: column; gap: 4px; }
.fq-insights-section .fq-section-label {
  display: flex; align-items: center; gap: 6px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT FORMAT PICKER
   ═══════════════════════════════════════════════════════════════════════════ */
.fq-export-chevron {
  appearance: none; border: 1px solid var(--fq-border);
  background: var(--fq-surface); color: var(--fq-muted);
  cursor: pointer; font-size: 10px; transition: all 0.15s;
}
.fq-export-chevron:hover { color: var(--fq-text); border-color: var(--fq-muted); }
.fq-export-menu {
  position: absolute; bottom: 100%; right: 0;
  margin-bottom: 4px; min-width: 160px;
  background: var(--fq-panel); border: 1px solid var(--fq-border);
  border-radius: var(--fq-radius); box-shadow: var(--fq-shadow);
  overflow: hidden; z-index: 50;
}
.fq-export-menu button {
  display: block; width: 100%; text-align: left;
  appearance: none; border: none; background: transparent;
  color: var(--fq-text); font-size: 12px; padding: 8px 12px;
  cursor: pointer; transition: background 0.15s;
  font-family: var(--fq-font);
}
.fq-export-menu button:hover { background: rgba(255,255,255,0.04); }
.fq-export-menu button + button { border-top: 1px solid var(--fq-border-subtle); }
`;
