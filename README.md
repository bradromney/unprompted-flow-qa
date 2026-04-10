# unprompted-flow-qa

Dev-only **strategic evaluation** shell for React SPAs: Shadow DOM sidebar, local-first issues with screenshots, AI-assisted flow JSON + `strategic_observations`, git-aware mission briefing, grouped exports (Markdown + JSON with `strategic_summary`).

## Install

```bash
npm install unprompted-flow-qa
```

Peer dependencies: `react`, `react-dom`.

## Vite + React integration

### 1. Generate static assets (CLI)

From your app root:

```bash
npx flow-qa generate --routes public/flow-qa/routes.json --out public/flow-qa
npx flow-qa git-context --out public/flow-qa/git-context.json
```

`routes.json` maps router paths to source files (see [examples/routes.sample.json](examples/routes.sample.json)).  
Set `OPENAI_API_KEY` for LLM-backed generation; otherwise a **stub** bundle + observations is written.

### 2. Wrap the app (DEV only)

```tsx
import { FlowQARoot } from "unprompted-flow-qa";
import type { RouteConfig } from "unprompted-flow-qa";

const flowQaRouteConfig: RouteConfig = {
  routes: [
    { path: "/", file: "src/pages/Home.tsx" },
    // …same as routes.json
  ],
};

function subscribePath(cb: () => void) {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}

// main.tsx
if (import.meta.env.DEV) {
  root.render(
    <FlowQARoot
      routeConfig={flowQaRouteConfig}
      getLocation={() => ({
        pathname: window.location.pathname,
        search: window.location.search,
      })}
      subscribeLocation={subscribePath}
      flowQaAssetBase="/flow-qa"
      gitContextPath="git-context.json"
    >
      <App />
    </FlowQARoot>
  );
} else {
  root.render(<App />);
}
```

Use **React Router**’s `useLocation` inside a tiny wrapper if you prefer subscription via the router.

### 3. Keyboard shortcut

Toggle the sidebar with **Control+Shift+F** (use **Control ⌃**, not **Command ⌘**, on Mac). Alternates: **Control+Shift+`** (US backtick) or **Control+Option+F** if your keyboard layout makes Shift+` awkward. You can also run **`__FLOW_QA_TOGGLE__()`** in the browser console. Avoid **⌘⇧Q** on macOS — that logs you out.

**Flow QA only loads in Vite dev** (`npm run dev`). It is not included in production or `vite preview` builds.

## Package layout

| Path | Purpose |
|------|---------|
| `FlowQARoot` | Wraps children + viewport presets + Shadow DOM sidebar |
| `flow-qa` CLI | `generate`, `git-context` |
| `unprompted-flow-qa/vite-plugin` | No-op placeholder for future git virtual modules |

## `public/flow-qa` files

- `manifest.json` — `{ "files": ["flows/generated.json"] }`
- `flows/*.json` — `{ version, flows, steps }`
- `strategic-observations.json` — `{ "strategic_observations": [...] }`
- `git-context.json` — `{ base, changedFiles, generatedAt }`

## License

MIT
