import type { Flow, FlowBundle, RouteConfig, RouteConfigEntry } from "./types";
import type { GitContextFile } from "./types";
import { matchStepPath } from "./match-url";

export function fileTouchesRoute(entry: RouteConfigEntry, changedFile: string): boolean {
  const norm = (p: string) => p.replace(/^\.\//, "");
  if (norm(changedFile) === norm(entry.file)) return true;
  if (changedFile.endsWith(entry.file)) return true;
  return false;
}

export function changedRoutes(
  git: GitContextFile | null,
  routeConfig: RouteConfig
): RouteConfigEntry[] {
  if (!git?.changedFiles?.length) return [];
  const out: RouteConfigEntry[] = [];
  for (const route of routeConfig.routes) {
    for (const cf of git.changedFiles) {
      if (fileTouchesRoute(route, cf)) {
        out.push(route);
        break;
      }
    }
  }
  return dedupeRoutes(out);
}

function dedupeRoutes(r: RouteConfigEntry[]): RouteConfigEntry[] {
  const seen = new Set<string>();
  return r.filter((x) => {
    const k = x.path + "\0" + x.file;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Rough: does this flow likely cover this route path? */
export function flowTouchesRoutePath(flow: Flow, steps: FlowBundle["steps"], routePath: string): boolean {
  const example = routePathToExamplePath(routePath);
  for (const sid of flow.steps) {
    const step = steps[sid];
    if (!step) continue;
    if (matchStepPath(example, step.urlPattern, step.type ?? "glob")) return true;
  }
  return false;
}

/** Build a concrete pathname from a route pattern for matching step globs */
export function routePathToExamplePath(routePath: string): string {
  const withParams = routePath
    .split("/")
    .map((seg) => (seg.startsWith(":") || seg.startsWith("*") ? "x" : seg))
    .join("/");
  return withParams.startsWith("/") ? withParams : "/" + withParams;
}

export function flowsCoveringChangedRoutes(
  bundle: FlowBundle,
  routes: RouteConfigEntry[]
): Flow[] {
  if (!routes.length) return [];
  return bundle.flows.filter((f) =>
    routes.some((r) => flowTouchesRoutePath(f, bundle.steps, r.path))
  );
}

export function assumptionsForFlows(flows: Flow[]): string[] {
  const set = new Set<string>();
  for (const f of flows) {
    for (const a of f.assumptions_tested ?? []) {
      if (a.trim()) set.add(a.trim());
    }
  }
  return [...set];
}
