import type { Issue } from "./types";

function tokenOverlap(a: string, b: string): number {
  const ta = a.toLowerCase().split(/\s+/).filter(Boolean);
  const tb = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const set = new Set(ta);
  let hit = 0;
  for (const w of tb) if (set.has(w)) hit++;
  return hit / Math.min(ta.length, tb.length);
}

function similarNotes(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  if (a.includes(b.slice(0, 40)) || b.includes(a.slice(0, 40))) return true;
  return tokenOverlap(a, b) >= 0.35;
}

function routeBucket(issue: Issue, flowStepRoute: (flowId: string, stepId: string) => string | undefined): string | undefined {
  return flowStepRoute(issue.flowId, issue.stepId);
}

/** Returns groups of issue ids that are potentially related (any 2 of 4 signals). */
export function clusterRelatedIssues(
  issues: Issue[],
  flowStepRoute: (flowId: string, stepId: string) => string | undefined
): string[][] {
  const n = issues.length;
  const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = issues[i];
      const b = issues[j];
      let signals = 0;
      if (a.componentName && b.componentName && a.componentName === b.componentName) signals++;
      const ra = routeBucket(a, flowStepRoute);
      const rb = routeBucket(b, flowStepRoute);
      if (ra && rb && ra === rb) signals++;
      if (similarNotes(a.notes, b.notes)) signals++;
      if (a.selector && b.selector && a.selector === b.selector) signals++;
      if (signals >= 2) {
        adj[i][j] = adj[j][i] = true;
      }
    }
  }

  const visited = new Set<number>();
  const groups: string[][] = [];
  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    const stack = [i];
    const comp: number[] = [];
    visited.add(i);
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(u);
      for (let v = 0; v < n; v++) {
        if (adj[u][v] && !visited.has(v)) {
          visited.add(v);
          stack.push(v);
        }
      }
    }
    if (comp.length > 1) {
      groups.push(comp.map((idx) => issues[idx].id));
    }
  }
  return groups;
}
