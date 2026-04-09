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
.fq-collapse summary { cursor: pointer; color: var(--fq-muted); }
.fq-collapse .fq-card { margin-top: 8px; }
`;
