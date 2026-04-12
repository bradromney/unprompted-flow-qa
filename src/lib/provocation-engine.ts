/**
 * Provocation Engine — rule-based generator for opinionated co-founder cards.
 *
 * Deterministic: same StrategyState = same provocations. No LLM, no randomness.
 * Produces 1-3 provocations, prioritized by severity.
 */

import type { StrategyState, AssumptionHealth, StrategySignal, SegmentCoverage } from "./strategy-inference";
import type { FlowBundle, Issue, StrategicObservation } from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type Stratum = "strategy" | "architecture" | "experience" | "surface";

export interface ProvocationOption {
  label: string;
  action: "copy_prompt" | "dismiss" | "navigate";
  promptOverride?: string;
  targetId?: string;
}

export interface Provocation {
  id: string;
  thesis: string;
  whyNow: string;
  stratum: Stratum;
  severity: "critical" | "important" | "notable";
  options: ProvocationOption[];
  promptFragment: string;
  relatedIds: string[];
}

/* ─── Context for generation ──────────────────────────────────────────────── */

export interface ProvocationContext {
  strategyState: StrategyState;
  bundle: FlowBundle;
  issues: Issue[];
  observations: StrategicObservation[];
  stale: Set<string>;
  pathname: string;
  /** IDs previously dismissed — skip these unless inputs changed */
  dismissedIds: Set<string>;
}

/* ─── Stable ID from inputs ───────────────────────────────────────────────── */

function stableId(prefix: string, key: string): string {
  // Deterministic: same prefix+key = same ID. Allows dismissal tracking.
  let hash = 0;
  const s = `${prefix}:${key}`;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return `prov-${prefix}-${Math.abs(hash).toString(36)}`;
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

/* ─── Generators ──────────────────────────────────────────────────────────── */

function* contradictedAssumptions(ctx: ProvocationContext): Generator<Provocation> {
  const atRisk = ctx.strategyState.assumptions.filter(
    (a) => a.status === "at_risk" && a.contradicts > 0 && a.supports === 0
  );

  for (const a of atRisk) {
    const id = stableId("contradicted", a.assumption);
    if (ctx.dismissedIds.has(id)) continue;

    const flowNames = a.flowIds
      .map((fid) => ctx.bundle.flows.find((f) => f.id === fid)?.title)
      .filter(Boolean)
      .slice(0, 2);

    yield {
      id,
      thesis: `"${trunc(a.assumption, 70)}" has ${a.contradicts} contradicting evidence and zero supporting. You might be building on a false premise.`,
      whyNow: `${a.contradicts} contradicting observation${a.contradicts !== 1 ? "s" : ""} logged${flowNames.length ? ` in ${flowNames.join(", ")}` : ""}.`,
      stratum: "strategy",
      severity: "critical",
      options: [
        {
          label: "Rethink this assumption",
          action: "copy_prompt",
          promptOverride: `## Strategic Challenge\n\nThe assumption "${a.assumption}" has ${a.contradicts} pieces of contradicting evidence and no supporting evidence.\n\nFlows affected: ${a.flowIds.join(", ")}\nSteps testing this: ${a.stepIds.join(", ")}\n\nResearch whether this assumption still holds. Check competitor approaches. Recommend whether to pivot these flows or double down with changes.\n`,
        },
        {
          label: "Fix the flow",
          action: "copy_prompt",
        },
        {
          label: "Dismiss \u2014 I know something you don\u2019t",
          action: "dismiss",
        },
      ],
      promptFragment: `**Assumption at risk:** "${a.assumption}" \u2014 ${a.contradicts} contradicting, 0 supporting.\nFlows: ${a.flowIds.join(", ")}. Steps: ${a.stepIds.join(", ")}.\n`,
      relatedIds: [...a.flowIds, ...a.stepIds],
    };
  }
}

function* mixedAssumptions(ctx: ProvocationContext): Generator<Provocation> {
  const mixed = ctx.strategyState.assumptions.filter(
    (a) => a.status === "mixed" && a.contradicts > 0 && a.supports > 0
  );

  for (const a of mixed) {
    const id = stableId("mixed", a.assumption);
    if (ctx.dismissedIds.has(id)) continue;

    yield {
      id,
      thesis: `"${trunc(a.assumption, 70)}" has conflicting evidence: ${a.supports} supporting, ${a.contradicts} contradicting. Which signal do you trust?`,
      whyNow: `Evidence is split \u2014 this assumption needs a decision, not more data.`,
      stratum: "strategy",
      severity: "important",
      options: [
        {
          label: "Investigate deeper",
          action: "copy_prompt",
          promptOverride: `## Assumption with Mixed Evidence\n\n"${a.assumption}"\n- ${a.supports} supporting evidence\n- ${a.contradicts} contradicting evidence\n- ${a.ambiguous} ambiguous\n\nAnalyze the evidence for and against this assumption. What would definitively prove or disprove it? Suggest a specific test.\n`,
        },
        {
          label: "Lean in \u2014 keep building",
          action: "dismiss",
        },
        {
          label: "Dismiss",
          action: "dismiss",
        },
      ],
      promptFragment: `**Assumption contested:** "${a.assumption}" \u2014 ${a.supports}\u2191 ${a.contradicts}\u2193 ${a.ambiguous}~.\n`,
      relatedIds: [...a.flowIds, ...a.stepIds],
    };
  }
}

function* staleFlows(ctx: ProvocationContext): Generator<Provocation> {
  for (const f of ctx.bundle.flows) {
    const staleCount = f.steps.filter((s) => ctx.stale.has(s)).length;
    if (staleCount <= 1 || staleCount / f.steps.length <= 0.5) continue;

    const id = stableId("stale", f.id);
    if (ctx.dismissedIds.has(id)) continue;

    yield {
      id,
      thesis: `"${f.title}" has ${staleCount}/${f.steps.length} stale steps. Code moved but your review didn\u2019t follow.`,
      whyNow: `Recent code changes touched files mapped to this flow.`,
      stratum: "architecture",
      severity: "important",
      options: [
        {
          label: "Re-review now",
          action: "navigate",
          targetId: f.id,
        },
        {
          label: "Queue for agent",
          action: "copy_prompt",
          promptOverride: `## Stale Flow Review\n\nThe flow "${f.title}" has ${staleCount}/${f.steps.length} steps that changed since last review.\n\nFlow ID: ${f.id}\nStrategic intent: ${f.strategic_intent ?? "not set"}\n\nReview each stale step. Check if the changes broke the expected behavior or shifted the user experience. Report findings.\n`,
        },
        {
          label: "Dismiss",
          action: "dismiss",
        },
      ],
      promptFragment: `**Stale flow:** "${f.title}" \u2014 ${staleCount}/${f.steps.length} steps changed since last review.\n`,
      relatedIds: [f.id, ...f.steps.filter((s) => ctx.stale.has(s))],
    };
  }
}

function* coverageGaps(ctx: ProvocationContext): Generator<Provocation> {
  for (const seg of ctx.strategyState.segments) {
    if (seg.coverage >= 0.3 || seg.totalSteps <= 2) continue;

    const id = stableId("coverage", seg.segment);
    if (ctx.dismissedIds.has(id)) continue;

    yield {
      id,
      thesis: `The "${seg.segment}" segment has ${Math.round(seg.coverage * 100)}% coverage. That\u2019s a blind spot in your strategy.`,
      whyNow: `${seg.visitedSteps}/${seg.totalSteps} steps visited across ${seg.flowCount} flow${seg.flowCount !== 1 ? "s" : ""}.`,
      stratum: "strategy",
      severity: "notable",
      options: [
        {
          label: "Start testing",
          action: "navigate",
        },
        {
          label: "Dismiss",
          action: "dismiss",
        },
      ],
      promptFragment: `**Coverage gap:** "${seg.segment}" segment at ${Math.round(seg.coverage * 100)}% (${seg.visitedSteps}/${seg.totalSteps} steps).\n`,
      relatedIds: [],
    };
  }
}

function* orphanedObservations(ctx: ProvocationContext): Generator<Provocation> {
  for (const obs of ctx.observations) {
    // Only surface observations relevant to current page
    const lower = obs.observation.toLowerCase();
    const path = ctx.pathname.toLowerCase();
    const pageMatch =
      (path.startsWith("/pipeline") && (lower.includes("pipeline") || lower.includes("stage"))) ||
      (path.startsWith("/contacts") && (lower.includes("contact") || lower.includes("outreach"))) ||
      (path.startsWith("/strategy") && (lower.includes("strategy") || lower.includes("positioning"))) ||
      (path.startsWith("/profile") && lower.includes("profile")) ||
      (path === "/" && (lower.includes("landing") || lower.includes("onboard")));

    if (!pageMatch) continue;

    // Check if any issues reference this observation's keywords
    const hasRelatedIssue = ctx.issues.some((i) => {
      const iLower = i.notes.toLowerCase();
      const obsWords = lower.split(/\s+/).filter((w) => w.length > 5);
      return obsWords.some((w) => iLower.includes(w));
    });

    if (hasRelatedIssue) continue; // Not orphaned

    const id = stableId("orphan", obs.observation.slice(0, 40));
    if (ctx.dismissedIds.has(id)) continue;

    yield {
      id,
      thesis: `${trunc(obs.observation, 90)} \u2014 noticed but never investigated.`,
      whyNow: `You\u2019re on a page where this is relevant.`,
      stratum: "experience",
      severity: "notable",
      options: [
        {
          label: "Investigate",
          action: "copy_prompt",
          promptOverride: `## Uninvestigated Observation\n\n"${obs.observation}"\n\nType: ${obs.type}\n${obs.suggested_assumption ? `Suggested assumption: ${obs.suggested_assumption}\n` : ""}\nInvestigate whether this observation represents a real issue. Check the relevant code and user flows. Report findings with severity assessment.\n`,
        },
        {
          label: "Note it",
          action: "dismiss",
        },
      ],
      promptFragment: `**Unexamined observation:** "${trunc(obs.observation, 100)}" (${obs.type}).\n`,
      relatedIds: [],
    };
  }
}

/* ─── Main Engine ─────────────────────────────────────────────────────────── */

const MAX_PROVOCATIONS = 3;

/**
 * Generate provocations from current state. Deterministic.
 * Returns at most MAX_PROVOCATIONS, prioritized: contradicted > mixed > stale > gaps > orphans.
 */
export function generateProvocations(ctx: ProvocationContext): Provocation[] {
  const result: Provocation[] = [];

  const generators = [
    contradictedAssumptions(ctx),
    mixedAssumptions(ctx),
    staleFlows(ctx),
    coverageGaps(ctx),
    orphanedObservations(ctx),
  ];

  for (const gen of generators) {
    for (const p of gen) {
      result.push(p);
      if (result.length >= MAX_PROVOCATIONS) return result;
    }
  }

  return result;
}
