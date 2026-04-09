import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FlowBundle, StrategicObservation } from "../lib/types";

interface GenerateOpts {
  cwd: string;
  outDir: string;
  routesFile?: string;
  openaiModel?: string;
}

function readRoutesJson(path: string): { routes: { path: string; file: string }[] } {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as { routes: { path: string; file: string }[] };
}

function stubBundle(routes: { path: string; file: string }[]): {
  bundle: FlowBundle;
  observations: StrategicObservation[];
} {
  const steps: FlowBundle["steps"] = {};
  const flows: FlowBundle["flows"] = [];
  let si = 0;
  for (const r of routes.slice(0, 8)) {
    const fid = `flow-${si}`;
    const sid = `step-${si}-a`;
    const examplePath = r.path.replace(/:[^/]+/g, "x");
    const glob = examplePath.includes("*") ? examplePath : `${examplePath}*`;
    steps[sid] = {
      id: sid,
      urlPattern: glob.startsWith("/") ? glob : `/${glob}`,
      type: "glob",
      instructions: `Visit ${r.path} (${r.file})`,
      expected_emotion: "oriented",
      success_looks_like: "Primary content for this route is visible without confusion.",
      failure_signal: "Blank state, error boundary, or missing primary CTA.",
      assumption_dependency: `Route ${r.path} reflects the intended IA for this feature.`,
    };
    flows.push({
      id: fid,
      title: `Explore ${r.path}`,
      steps: [sid],
      segment: "builder",
      jtbd: `Validate that ${r.path} serves its intended job`,
      assumptions_tested: [
        `Users understand what to do on ${r.path} without external context`,
      ],
      strategic_intent: `Confirm ${r.path} communicates purpose and next actions clearly.`,
      eval_dimension: "ux",
      tags: [r.file],
    });
    si++;
  }

  const observations: StrategicObservation[] = [
    {
      observation:
        "Routes were generated from routes.json without reading component bodies — run with OPENAI_API_KEY for deeper inference.",
      type: "stub_mode",
    },
    {
      observation:
        "Consider whether high-traffic routes share layout components; inconsistent shells often indicate unstable IA.",
      type: "implementation_inconsistency",
      suggested_assumption: "Users experience a coherent navigation model across primary routes",
    },
  ];

  return { bundle: { version: 1, flows, steps }, observations };
}

async function callOpenAI(
  model: string,
  system: string,
  user: string
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  return text;
}

function extractJsonBlock(text: string): string {
  const fence = text.indexOf("```");
  if (fence >= 0) {
    const rest = text.slice(fence + 3);
    const end = rest.indexOf("```");
    const inner = (end >= 0 ? rest.slice(0, end) : rest).replace(/^json\s*/i, "").trim();
    return inner;
  }
  return text.trim();
}

async function generateWithLlm(opts: GenerateOpts, routes: { path: string; file: string }[]) {
  const model = opts.openaiModel ?? "gpt-4o-mini";
  const system = `You infer testable product hypotheses and user jobs from a route table.
Return VALID JSON ONLY with this shape:
{
  "bundle": { "version": 1, "flows": Flow[], "steps": { [id]: Step } },
  "strategic_observations": { "observation": string, "type": string, "suggested_assumption"?: string }[]
}
Flow and Step objects MUST include strategic fields where inferable:
Flow: id, title, steps (step ids), optional segment, jtbd, assumptions_tested, strategic_intent, eval_dimension
Step: id, urlPattern (prefer glob), type glob|regex, instructions, optional selector, expected_emotion, success_looks_like, failure_signal, assumption_dependency
Emit 5-15 strategic_observations when possible; prefer specific falsifiable statements.`;

  const user = `Routes (path + source file):\n${JSON.stringify(routes, null, 2)}\n\nInfer major user journeys and draft flows + steps.`;

  const raw = await callOpenAI(model, system, user);
  const json = extractJsonBlock(raw);
  const parsed = JSON.parse(json) as {
    bundle: FlowBundle;
    strategic_observations: StrategicObservation[];
  };
  return parsed;
}

export async function runGenerate(opts: GenerateOpts): Promise<void> {
  const out = resolve(opts.cwd, opts.outDir);
  mkdirSync(out, { recursive: true });
  mkdirSync(resolve(out, "flows"), { recursive: true });

  let routes: { path: string; file: string }[] = [];
  if (opts.routesFile && existsSync(resolve(opts.cwd, opts.routesFile))) {
    const rj = readRoutesJson(resolve(opts.cwd, opts.routesFile));
    routes = rj.routes ?? [];
  }

  let bundle: FlowBundle;
  let observations: StrategicObservation[];

  if (process.env.OPENAI_API_KEY && routes.length) {
    try {
      const parsed = await generateWithLlm(opts, routes);
      bundle = parsed.bundle;
      observations = parsed.strategic_observations ?? [];
    } catch (e) {
      console.warn("LLM generation failed, falling back to stub:", e);
      ({ bundle, observations } = stubBundle(routes.length ? routes : [{ path: "/", file: "app" }]));
    }
  } else {
    ({ bundle, observations } = stubBundle(routes.length ? routes : [{ path: "/", file: "app" }]));
  }

  const flowFile = resolve(out, "flows", "generated.json");
  writeFileSync(flowFile, JSON.stringify(bundle, null, 2), "utf-8");

  const manifest = {
    files: ["flows/generated.json"],
  };
  writeFileSync(resolve(out, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

  const obsPayload = { strategic_observations: observations };
  writeFileSync(resolve(out, "strategic-observations.json"), JSON.stringify(obsPayload, null, 2), "utf-8");

  let stepCount = 0;
  for (const f of bundle.flows) stepCount += f.steps.length;
  console.log(`Generated ${bundle.flows.length} flows with ${stepCount} steps`);
  console.log(`Found ${observations.length} strategic observations`);
}
