import type { FlowBundle, Issue, StrategicObservation } from "./types";

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
