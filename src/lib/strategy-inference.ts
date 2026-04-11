import type { Flow, FlowBundle, Issue, StrategicObservation } from "./types";

/* ─── Assumption Health ─────────────────────────────────────────────────── */

export type AssumptionStatus = "confirmed" | "at_risk" | "mixed" | "untested";

export interface AssumptionHealth {
  assumption: string;
  status: AssumptionStatus;
  supports: number;
  contradicts: number;
  ambiguous: number;
  /** Issue IDs that reference this assumption */
  evidenceIds: string[];
  /** Flow IDs that declare this assumption */
  flowIds: string[];
  /** Step IDs whose assumption_dependency matches */
  stepIds: string[];
}

/** Compute health for every declared assumption across all flows and evidence. */
export function computeAssumptionHealth(
  bundle: FlowBundle,
  issues: Issue[]
): AssumptionHealth[] {
  // Collect all declared assumptions → which flows declare them
  const map = new Map<
    string,
    {
      supports: number;
      contradicts: number;
      ambiguous: number;
      evidenceIds: string[];
      flowIds: Set<string>;
      stepIds: Set<string>;
    }
  >();

  const ensure = (key: string) => {
    if (!map.has(key))
      map.set(key, {
        supports: 0,
        contradicts: 0,
        ambiguous: 0,
        evidenceIds: [],
        flowIds: new Set(),
        stepIds: new Set(),
      });
    return map.get(key)!;
  };

  // 1. Gather from flow-level declarations
  for (const f of bundle.flows) {
    for (const a of f.assumptions_tested ?? []) {
      const t = a.trim();
      if (!t) continue;
      ensure(t).flowIds.add(f.id);
    }
  }

  // 2. Gather from step-level assumption_dependency
  for (const [sid, step] of Object.entries(bundle.steps)) {
    const dep = step.assumption_dependency?.trim();
    if (!dep) continue;
    ensure(dep).stepIds.add(sid);
    // Also find which flow owns this step
    for (const f of bundle.flows) {
      if (f.steps.includes(sid)) ensure(dep).flowIds.add(f.id);
    }
  }

  // 3. Tally evidence from assumption_evidence issues
  for (const issue of issues) {
    if (issue.type !== "assumption_evidence") continue;
    const step = bundle.steps[issue.stepId];
    const dep = step?.assumption_dependency?.trim();
    if (!dep) continue;
    const entry = ensure(dep);
    entry.evidenceIds.push(issue.id);
    if (issue.evidence_direction === "supports") entry.supports += 1;
    else if (issue.evidence_direction === "contradicts") entry.contradicts += 1;
    else if (issue.evidence_direction === "ambiguous") entry.ambiguous += 1;
  }

  // 4. Derive status
  return [...map.entries()]
    .map(([assumption, v]) => {
      let status: AssumptionStatus = "untested";
      const total = v.supports + v.contradicts + v.ambiguous;
      if (total > 0) {
        if (v.contradicts > 0 && v.supports === 0) status = "at_risk";
        else if (v.supports > 0 && v.contradicts === 0) status = "confirmed";
        else if (v.contradicts > 0 && v.supports > 0) status = "mixed";
        else status = "mixed"; // only ambiguous
      }
      return {
        assumption,
        status,
        supports: v.supports,
        contradicts: v.contradicts,
        ambiguous: v.ambiguous,
        evidenceIds: v.evidenceIds,
        flowIds: [...v.flowIds],
        stepIds: [...v.stepIds],
      };
    })
    .sort((a, b) => {
      // at_risk first, mixed, untested, confirmed last
      const order: Record<AssumptionStatus, number> = {
        at_risk: 0,
        mixed: 1,
        untested: 2,
        confirmed: 3,
      };
      return order[a.status] - order[b.status];
    });
}

/* ─── Coverage Analysis ─────────────────────────────────────────────────── */

export interface SegmentCoverage {
  segment: string;
  flowCount: number;
  totalSteps: number;
  visitedSteps: number;
  issueCount: number;
  staleSteps: number;
  /** Fraction 0-1 of steps visited */
  coverage: number;
}

export function computeSegmentCoverage(
  bundle: FlowBundle,
  visited: Record<string, number>,
  issues: Issue[],
  stale: Set<string>
): SegmentCoverage[] {
  const segments = new Map<
    string,
    { flowCount: number; totalSteps: number; visitedSteps: number; issueCount: number; staleSteps: number }
  >();

  const ensure = (seg: string) => {
    if (!segments.has(seg))
      segments.set(seg, { flowCount: 0, totalSteps: 0, visitedSteps: 0, issueCount: 0, staleSteps: 0 });
    return segments.get(seg)!;
  };

  for (const f of bundle.flows) {
    const seg = f.segment?.trim() || "unassigned";
    const entry = ensure(seg);
    entry.flowCount += 1;
    for (const sid of f.steps) {
      entry.totalSteps += 1;
      if (visited[sid]) entry.visitedSteps += 1;
      if (stale.has(sid)) entry.staleSteps += 1;
    }
  }

  // Issues per segment (via flow)
  const flowSegment = new Map<string, string>();
  for (const f of bundle.flows) flowSegment.set(f.id, f.segment?.trim() || "unassigned");
  for (const issue of issues) {
    const seg = flowSegment.get(issue.flowId) ?? "unassigned";
    ensure(seg).issueCount += 1;
  }

  return [...segments.entries()]
    .map(([segment, v]) => ({
      segment,
      ...v,
      coverage: v.totalSteps > 0 ? v.visitedSteps / v.totalSteps : 0,
    }))
    .sort((a, b) => a.coverage - b.coverage); // least coverage first
}

/* ─── Strategy Signals ──────────────────────────────────────────────────── */

export interface StrategySignal {
  type: "assumption_at_risk" | "coverage_gap" | "stale_cluster" | "observation_match";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  /** Related entity IDs for linking */
  relatedIds?: string[];
}

/**
 * Synthesize high-level strategy signals from all available data.
 * These are the "so what?" takeaways — things Brad should act on.
 */
export function computeStrategySignals(
  bundle: FlowBundle,
  issues: Issue[],
  observations: StrategicObservation[],
  visited: Record<string, number>,
  stale: Set<string>,
  assumptionHealth: AssumptionHealth[],
  segmentCoverage: SegmentCoverage[]
): StrategySignal[] {
  const signals: StrategySignal[] = [];

  // 1. Assumptions at risk
  const atRisk = assumptionHealth.filter((a) => a.status === "at_risk");
  for (const a of atRisk) {
    signals.push({
      type: "assumption_at_risk",
      severity: "high",
      title: `Assumption contradicted`,
      detail: `"${trunc(a.assumption, 80)}" — ${a.contradicts} contradicting evidence, 0 supporting`,
      relatedIds: a.evidenceIds,
    });
  }

  // 2. Mixed assumptions (have both supporting and contradicting evidence)
  const mixed = assumptionHealth.filter((a) => a.status === "mixed" && a.contradicts > 0);
  for (const a of mixed) {
    signals.push({
      type: "assumption_at_risk",
      severity: "medium",
      title: `Assumption has mixed evidence`,
      detail: `"${trunc(a.assumption, 80)}" — ${a.supports} supporting, ${a.contradicts} contradicting`,
      relatedIds: a.evidenceIds,
    });
  }

  // 3. Coverage gaps — segments with < 30% coverage
  for (const seg of segmentCoverage) {
    if (seg.coverage < 0.3 && seg.totalSteps > 2) {
      signals.push({
        type: "coverage_gap",
        severity: seg.coverage === 0 ? "high" : "medium",
        title: `Low coverage: ${seg.segment}`,
        detail: `${Math.round(seg.coverage * 100)}% of steps visited (${seg.visitedSteps}/${seg.totalSteps})`,
      });
    }
  }

  // 4. Stale clusters — flows where > 50% of steps are stale
  for (const f of bundle.flows) {
    const staleCount = f.steps.filter((s) => stale.has(s)).length;
    if (staleCount > 1 && staleCount / f.steps.length > 0.5) {
      signals.push({
        type: "stale_cluster",
        severity: "medium",
        title: `"${f.title}" mostly stale`,
        detail: `${staleCount}/${f.steps.length} steps changed since last review`,
        relatedIds: [f.id],
      });
    }
  }

  // 5. Observations that match issue patterns
  for (const obs of observations) {
    const lower = obs.observation.toLowerCase();
    // Check if any bug/ux_friction issues mention similar keywords
    const relatedIssues = issues.filter((i) => {
      const iLower = i.notes.toLowerCase();
      // Simple keyword overlap — find shared significant words
      const obsWords = lower.split(/\s+/).filter((w) => w.length > 4);
      return obsWords.some((w) => iLower.includes(w));
    });
    if (relatedIssues.length > 0) {
      signals.push({
        type: "observation_match",
        severity: "low",
        title: `Observation corroborated`,
        detail: `"${trunc(obs.observation, 70)}" — ${relatedIssues.length} related issue${relatedIssues.length !== 1 ? "s" : ""}`,
        relatedIds: relatedIssues.map((i) => i.id),
      });
    }
  }

  // Sort: high severity first
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return signals;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

/* ─── Full Strategy State ───────────────────────────────────────────────── */

export interface StrategyState {
  assumptions: AssumptionHealth[];
  segments: SegmentCoverage[];
  signals: StrategySignal[];
}

/** Compute the full strategy state in one call. */
export function computeStrategyState(ctx: {
  bundle: FlowBundle;
  issues: Issue[];
  observations: StrategicObservation[];
  visited: Record<string, number>;
  stale: Set<string>;
}): StrategyState {
  const assumptions = computeAssumptionHealth(ctx.bundle, ctx.issues);
  const segments = computeSegmentCoverage(ctx.bundle, ctx.visited, ctx.issues, ctx.stale);
  const signals = computeStrategySignals(
    ctx.bundle,
    ctx.issues,
    ctx.observations,
    ctx.visited,
    ctx.stale,
    assumptions,
    segments
  );
  return { assumptions, segments, signals };
}
