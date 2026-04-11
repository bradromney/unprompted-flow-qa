import type { Flow, FlowBundle, RouteConfig, RouteConfigEntry, Step } from "./types";
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

/** Does this individual step touch a given route? */
export function stepTouchesRoute(step: Step, route: RouteConfigEntry): boolean {
  const example = routePathToExamplePath(route.path);
  return matchStepPath(example, step.urlPattern, step.type ?? "glob");
}

/**
 * Returns step IDs that are "stale" — the user reviewed them, but the underlying
 * source file has changed since that review (per git-context).
 *
 * A step is stale when:
 *   1. It has been visited (has a review timestamp)
 *   2. Its urlPattern maps to a route whose source file is in changedFiles
 *   3. The review timestamp is older than git-context generatedAt
 */
export function staleStepIds(
  bundle: FlowBundle,
  visited: Record<string, number>,
  gitCtx: GitContextFile | null,
  routeConfig: RouteConfig
): Set<string> {
  const stale = new Set<string>();
  if (!gitCtx?.changedFiles?.length) return stale;

  const generatedAt = new Date(gitCtx.generatedAt).getTime();
  const norm = (p: string) => p.replace(/^\.\//, "");
  const changedSet = new Set(gitCtx.changedFiles.map(norm));

  for (const [sid, step] of Object.entries(bundle.steps)) {
    const reviewedAt = visited[sid];
    if (!reviewedAt || reviewedAt >= generatedAt) continue; // not reviewed, or reviewed after changes

    for (const route of routeConfig.routes) {
      if (stepTouchesRoute(step, route) && changedSet.has(norm(route.file))) {
        stale.add(sid);
        break;
      }
    }
  }
  return stale;
}

/** Compute strategic coverage gaps across flows and steps */
export function strategicGaps(bundle: FlowBundle): {
  flowsMissingIntent: Flow[];
  flowsMissingAssumptions: Flow[];
  stepsMissingSuccess: string[];
  stepsMissingFailure: string[];
  totalAssumptions: string[];
} {
  const flowsMissingIntent = bundle.flows.filter((f) => !f.strategic_intent?.trim());
  const flowsMissingAssumptions = bundle.flows.filter(
    (f) => !f.assumptions_tested?.length
  );
  const stepsMissingSuccess: string[] = [];
  const stepsMissingFailure: string[] = [];
  for (const [sid, step] of Object.entries(bundle.steps)) {
    if (!step.success_looks_like?.trim()) stepsMissingSuccess.push(sid);
    if (!step.failure_signal?.trim()) stepsMissingFailure.push(sid);
  }
  const allAssumptions = new Set<string>();
  for (const f of bundle.flows) {
    for (const a of f.assumptions_tested ?? []) {
      if (a.trim()) allAssumptions.add(a.trim());
    }
  }
  return {
    flowsMissingIntent,
    flowsMissingAssumptions,
    stepsMissingSuccess,
    stepsMissingFailure,
    totalAssumptions: [...allAssumptions],
  };
}
