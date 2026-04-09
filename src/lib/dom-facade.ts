const STYLE_ID = "flow-qa-facade-styles";

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    [data-flow-qa-facade="empty"] > * {
      filter: blur(10px) grayscale(0.4);
      opacity: 0.35;
      pointer-events: none;
      user-select: none;
    }
  `;
  document.head.appendChild(s);
}

export function setFacadeModeOnApp(
  appEl: HTMLElement | null,
  mode: "off" | "empty_state" | "copy_review"
): void {
  if (!appEl) return;
  ensureStyles();
  if (mode === "empty_state") {
    appEl.setAttribute("data-flow-qa-facade", "empty");
  } else {
    appEl.removeAttribute("data-flow-qa-facade");
  }
}

export type CopyPatch = { selector: string; text: string };

const ORIGINAL_TEXT = new WeakMap<Element, string>();

export function applyCopyPatches(root: HTMLElement | null, patches: CopyPatch[]): void {
  if (!root) return;
  for (const { selector, text } of patches) {
    try {
      const el = root.querySelector(selector);
      if (!el) continue;
      if (!ORIGINAL_TEXT.has(el)) ORIGINAL_TEXT.set(el, el.textContent ?? "");
      el.textContent = text;
    } catch {
      /* invalid selector */
    }
  }
}

export function restoreCopyPatches(root: HTMLElement | null, patches: CopyPatch[]): void {
  if (!root) return;
  for (const { selector } of patches) {
    try {
      const el = root.querySelector(selector);
      if (!el) continue;
      const orig = ORIGINAL_TEXT.get(el);
      if (orig !== undefined) el.textContent = orig;
    } catch {
      /* ignore */
    }
  }
}
