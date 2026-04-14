import type { FlowBundle, Issue, StepAssessment, StrategicObservation } from "./types";
import type { ChangedFileGroup } from "./git-map";
import { computeAssumptionHealth, type AssumptionHealth } from "./strategy-inference";

export interface ExportContext {
  bundle: FlowBundle;
  issues: Issue[];
  observations: StrategicObservation[];
  getScreenshotBlob: (idbKey: string) => Promise<Blob | undefined>;
}

function assumptionRollup(issues: Issue[], bundle: FlowBundle): Array<{
  assumption: string;
  evidenceCount: number;
  supports: number;
  contradicts: number;
  ambiguous: number;
}> {
  const map = new Map<
    string,
    { evidenceCount: number; supports: number; contradicts: number; ambiguous: number }
  >();

  const add = (key: string, dir?: Issue["evidence_direction"]) => {
    const cur = map.get(key) ?? {
      evidenceCount: 0,
      supports: 0,
      contradicts: 0,
      ambiguous: 0,
    };
    cur.evidenceCount += 1;
    if (dir === "supports") cur.supports += 1;
    else if (dir === "contradicts") cur.contradicts += 1;
    else if (dir === "ambiguous") cur.ambiguous += 1;
    map.set(key, cur);
  };

  for (const i of issues) {
    if (i.type !== "assumption_evidence") continue;
    const step = bundle.steps[i.stepId];
    const text = step?.assumption_dependency?.trim();
    if (text) add(text, i.evidence_direction);
  }

  for (const f of bundle.flows) {
    for (const a of f.assumptions_tested ?? []) {
      const t = a.trim();
      if (!t) continue;
      if (!map.has(t)) map.set(t, { evidenceCount: 0, supports: 0, contradicts: 0, ambiguous: 0 });
    }
  }

  return [...map.entries()].map(([assumption, v]) => ({ assumption, ...v }));
}

function issuesByType(issues: Issue[]): Record<Issue["type"], number> {
  const out: Record<Issue["type"], number> = {
    bug: 0,
    ux_friction: 0,
    strategic_gap: 0,
    assumption_evidence: 0,
  };
  for (const i of issues) out[i.type] = (out[i.type] ?? 0) + 1;
  return out;
}

function flowsWithStrategicContext(bundle: FlowBundle): { populated: number; total: number } {
  const total = bundle.flows.length;
  const populated = bundle.flows.filter((f) => !!f.strategic_intent?.trim()).length;
  return { populated, total };
}

/** Group issues by a route bucket from step urlPattern */
function routeBucketForIssue(issue: Issue, bundle: FlowBundle): string {
  const step = bundle.steps[issue.stepId];
  return step?.urlPattern ?? "unknown-route";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function buildStrategicSummary(ctx: ExportContext) {
  const assumptionsRollup = assumptionRollup(ctx.issues, ctx.bundle);
  return {
    assumptions_tested: assumptionsRollup,
    issues_by_type: issuesByType(ctx.issues),
    strategic_observations: ctx.observations,
    flows_with_strategic_context: flowsWithStrategicContext(ctx.bundle),
  };
}

export async function exportMarkdown(ctx: ExportContext): Promise<string> {
  const summary = await buildStrategicSummary(ctx);
  const byRoute = new Map<string, Issue[]>();
  for (const i of ctx.issues) {
    const k = routeBucketForIssue(i, ctx.bundle);
    if (!byRoute.has(k)) byRoute.set(k, []);
    byRoute.get(k)!.push(i);
  }

  const lines: string[] = [];
  lines.push(`# Flow QA export`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  for (const [route, list] of [...byRoute.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## Route / pattern: \`${route}\``);
    lines.push("");
    for (const issue of list) {
      lines.push(`### Issue (${issue.type}) — ${issue.flowId} / ${issue.stepId}`);
      lines.push(`- **Notes:** ${issue.notes.replace(/\n/g, " ")}`);
      if (issue.strategic_note) lines.push(`- **Strategic note:** ${issue.strategic_note}`);
      if (issue.severity) lines.push(`- **Severity:** ${issue.severity}`);
      if (issue.evidence_direction) lines.push(`- **Evidence direction:** ${issue.evidence_direction}`);
      if (issue.componentName) {
        lines.push(`- **Component:** \`${issue.componentName}\``);
        if (issue.patternBreadth && issue.patternBreadth > 1) {
          lines.push(
            `- **Pattern:** This component (\`${issue.componentName}\`) appears in **${issue.patternBreadth}** locations — issue may affect other surfaces.`
          );
        }
      }
      if (issue.selector) lines.push(`- **Selector:** \`${issue.selector}\``);
      const blob = await ctx.getScreenshotBlob(issue.screenshot);
      if (blob) {
        const data = await blobToDataUrl(blob);
        lines.push(`- **Screenshot:**`);
        lines.push(`  ![screenshot](${data})`);
      }
      lines.push("");
    }
  }

  lines.push(`## Strategic Summary`);
  lines.push("");
  lines.push(`### Assumptions Under Test`);
  for (const row of summary.assumptions_tested) {
    lines.push(
      `- **"${row.assumption}"** — ${row.evidenceCount} evidence item(s) (${row.supports} supports, ${row.contradicts} contradicts, ${row.ambiguous} ambiguous)`
    );
  }
  if (!summary.assumptions_tested.length) lines.push(`- _(none rolled up)_`);
  lines.push("");
  lines.push(`### Issues by Type`);
  for (const [k, v] of Object.entries(summary.issues_by_type)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push("");
  lines.push(`### Strategic Observations (from codebase analysis)`);
  if (!ctx.observations.length) lines.push(`- _(none — run \`flow-qa generate\`)_`);
  for (const o of ctx.observations) {
    lines.push(`- **${o.type}:** ${o.observation}`);
    if (o.suggested_assumption) lines.push(`  - Suggested assumption: ${o.suggested_assumption}`);
  }
  lines.push("");

  return lines.join("\n");
}

/** Lightweight session prompt for clipboard → paste into Claude Code / Cursor */
export function buildSessionPrompt(ctx: {
  bundle: FlowBundle;
  issues: Issue[];
  observations: StrategicObservation[];
  notes: Record<string, string>;
  visited: Record<string, number>;
  changeGroups: ChangedFileGroup[];
}): string {
  const lines: string[] = [];
  const ts = new Date().toISOString().slice(0, 10);
  lines.push(`## Flow QA Review — ${ts}`, "");

  // Changed files → affected steps
  if (ctx.changeGroups.length) {
    lines.push("### What changed");
    for (const g of ctx.changeGroups) {
      lines.push(`**\`${g.file}\`**`);
      for (const s of g.affectedSteps) {
        const reviewed = ctx.visited[s.stepId] ? "✓" : "☐";
        const note = ctx.notes[s.stepId]?.trim();
        lines.push(`- ${reviewed} ${s.step.instructions ?? s.stepId} _(${s.flowTitle})_${note ? `\n  > ${note}` : ""}`);
      }
    }
    lines.push("");
  }

  // All notes (including those not in change groups)
  const notesEntries = Object.entries(ctx.notes).filter(([, t]) => t.trim());
  if (notesEntries.length) {
    lines.push("### Notes");
    for (const [sid, text] of notesEntries) {
      const step = ctx.bundle.steps[sid];
      lines.push(`- **${step?.instructions ?? sid}** — ${text.trim()}`);
    }
    lines.push("");
  }

  // Issues
  if (ctx.issues.length) {
    lines.push("### Issues");
    for (const issue of ctx.issues) {
      const step = ctx.bundle.steps[issue.stepId];
      lines.push(`- **${issue.type}**${issue.severity ? ` (${issue.severity})` : ""}: ${issue.notes}${step ? ` — _${step.instructions}_` : ""}`);
      if (issue.strategic_note) lines.push(`  Strategic: ${issue.strategic_note}`);
    }
    lines.push("");
  }

  // Strategy intelligence
  const health = computeAssumptionHealth(ctx.bundle, ctx.issues);
  const atRisk = health.filter((a) => a.status === "at_risk" || a.status === "mixed");
  const confirmed = health.filter((a) => a.status === "confirmed");
  const untested = health.filter((a) => a.status === "untested");

  if (atRisk.length) {
    lines.push("### Assumptions at risk");
    for (const a of atRisk) {
      const tag = a.status === "at_risk" ? "CONTRADICTED" : "MIXED";
      lines.push(`- **[${tag}]** "${a.assumption}" — ${a.supports} supporting, ${a.contradicts} contradicting, ${a.ambiguous} ambiguous`);
    }
    lines.push("");
  }

  if (confirmed.length) {
    lines.push("### Assumptions confirmed");
    for (const a of confirmed) {
      lines.push(`- "${a.assumption}" — ${a.supports} supporting evidence`);
    }
    lines.push("");
  }

  if (untested.length) {
    lines.push("### Assumptions untested");
    for (const a of untested) {
      lines.push(`- "${a.assumption}" (${a.flowIds.length} flow${a.flowIds.length !== 1 ? "s" : ""}, ${a.stepIds.length} step${a.stepIds.length !== 1 ? "s" : ""})`);
    }
    lines.push("");
  }

  // Observations
  if (ctx.observations.length) {
    lines.push("### Observations from codebase");
    for (const o of ctx.observations) {
      lines.push(`- **${o.type}**: ${o.observation}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/* ─── Session Context (shared by all 4 export formats) ───────────────────── */

export interface SessionContext {
  bundle: FlowBundle;
  issues: Issue[];
  observations: StrategicObservation[];
  notes: Record<string, string>;
  visited: Record<string, number>;
  changeGroups: ChangedFileGroup[];
  stepAssessments: Record<string, StepAssessment>;
}

/**
 * 1. "Fix these" — user's notes + issues as AI-ready prompt.
 * Most common use case: paste into Lovable / Cursor / Claude Code.
 */
export function buildFixPrompt(ctx: SessionContext): string {
  const lines: string[] = [];
  lines.push("## Fix these issues", "");

  // Steps marked "needs work"
  const needsWork = Object.entries(ctx.stepAssessments)
    .filter(([, a]) => a.status === "needs-work")
    .map(([sid, a]) => {
      const step = ctx.bundle.steps[sid];
      return { sid, step, note: a.note };
    })
    .filter((e) => e.step);

  if (needsWork.length) {
    for (const { step, note } of needsWork) {
      lines.push(`- **${step!.instructions}**: needs work${note ? ` — "${note}"` : ""}`);
    }
    lines.push("");
  }

  // User notes, sorted by step
  const notesEntries = Object.entries(ctx.notes).filter(([, t]) => t.trim());
  if (notesEntries.length) {
    for (const [sid, text] of notesEntries) {
      const step = ctx.bundle.steps[sid];
      const route = step?.urlPattern ?? "";
      lines.push(`- On ${route}: "${text.trim()}"${step ? ` _(${step.instructions})_` : ""}`);
    }
    lines.push("");
  }

  // Issues by severity
  if (ctx.issues.length) {
    const sorted = [...ctx.issues].sort((a, b) => {
      const sev = { critical: 0, major: 1, minor: 2, observation: 3, undefined: 4 };
      return (sev[a.severity ?? "undefined"] ?? 4) - (sev[b.severity ?? "undefined"] ?? 4);
    });
    for (const issue of sorted) {
      const step = ctx.bundle.steps[issue.stepId];
      const sev = issue.severity ? ` (${issue.severity})` : "";
      lines.push(`- **${issue.type}**${sev}: ${issue.notes}${step ? ` — _${step.instructions}_` : ""}`);
    }
    lines.push("");
  }

  // Brief context
  if (ctx.changeGroups.length) {
    lines.push("### Context");
    lines.push("Changed files: " + ctx.changeGroups.map((g) => `\`${g.file}\``).join(", "));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 2. "Our analysis" — Flow QA's observations, strategic gaps, assumption risks.
 */
export function buildAnalysisPrompt(ctx: SessionContext): string {
  const lines: string[] = [];
  lines.push("## QA Analysis", "");

  // Observations
  if (ctx.observations.length) {
    lines.push("### Observations");
    for (const o of ctx.observations) {
      lines.push(`- **${o.type}**: ${o.observation}`);
    }
    lines.push("");
  }

  // Assumption health
  const health = computeAssumptionHealth(ctx.bundle, ctx.issues);
  const atRisk = health.filter((a) => a.status === "at_risk" || a.status === "mixed");
  if (atRisk.length) {
    lines.push("### At-risk assumptions");
    for (const a of atRisk) {
      const tag = a.status === "at_risk" ? "CONTRADICTED" : "MIXED";
      lines.push(`- **[${tag}]** "${a.assumption}" — ${a.supports}↑ ${a.contradicts}↓ ${a.ambiguous}~`);
    }
    lines.push("");
  }

  // Coverage gaps
  const untested = health.filter((a) => a.status === "untested");
  if (untested.length) {
    lines.push("### Untested assumptions");
    for (const a of untested) {
      lines.push(`- "${a.assumption}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 3. "Full session" — everything combined (enhanced buildSessionPrompt).
 */
export function buildFullExport(ctx: SessionContext): string {
  // Delegate to existing buildSessionPrompt which already includes everything
  const base = buildSessionPrompt(ctx);

  // Append step assessments
  const assessments = Object.entries(ctx.stepAssessments);
  if (!assessments.length) return base;

  const lines = [base];
  lines.push("### Step Assessments");
  for (const [sid, a] of assessments) {
    const step = ctx.bundle.steps[sid];
    const label = a.status === "good" ? "✓ Good" : "⚠ Needs work";
    lines.push(`- ${label}: ${step?.instructions ?? sid}${a.note ? ` — "${a.note}"` : ""}`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * 4. "Just my notes" — only user's notes and issues, no system context.
 */
export function buildRawNotes(ctx: SessionContext): string {
  const lines: string[] = [];
  const ts = new Date().toISOString().slice(0, 10);
  lines.push(`## QA Notes — ${ts}`, "");

  const notesEntries = Object.entries(ctx.notes).filter(([, t]) => t.trim());
  if (notesEntries.length) {
    lines.push("### Notes");
    for (const [sid, text] of notesEntries) {
      const step = ctx.bundle.steps[sid];
      lines.push(`- **${step?.instructions ?? sid}**: ${text.trim()}`);
    }
    lines.push("");
  }

  if (ctx.issues.length) {
    lines.push("### Issues");
    for (const issue of ctx.issues) {
      const step = ctx.bundle.steps[issue.stepId];
      const sev = issue.severity ? ` (${issue.severity})` : "";
      lines.push(`- **${issue.type}**${sev}: ${issue.notes}${step ? ` — _${step.instructions}_` : ""}`);
    }
    lines.push("");
  }

  const needsWork = Object.entries(ctx.stepAssessments)
    .filter(([, a]) => a.status === "needs-work" && a.note)
    .map(([sid, a]) => ({ step: ctx.bundle.steps[sid], note: a.note }));

  if (needsWork.length) {
    lines.push("### Needs work");
    for (const { step, note } of needsWork) {
      lines.push(`- **${step?.instructions ?? "?"}**: ${note}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function exportJson(ctx: ExportContext): Promise<string> {
  const summary = await buildStrategicSummary(ctx);
  const issuesOut = [];
  for (const issue of ctx.issues) {
    let screenshotDataUrl: string | undefined;
    const blob = await ctx.getScreenshotBlob(issue.screenshot);
    if (blob) screenshotDataUrl = await blobToDataUrl(blob);
    issuesOut.push({
      ...issue,
      screenshot_data_url: screenshotDataUrl,
    });
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    issues_grouped_by_route: Object.fromEntries(
      [...new Set(ctx.issues.map((i) => routeBucketForIssue(i, ctx.bundle)))].map((route) => [
        route,
        ctx.issues.filter((i) => routeBucketForIssue(i, ctx.bundle) === route),
      ])
    ),
    issues_flat: issuesOut,
    strategic_summary: summary,
  };
  return JSON.stringify(payload, null, 2);
}
