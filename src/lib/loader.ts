import type { FlowBundle, GitContextFile, StrategicObservation } from "./types";

export interface LoadedWorkspace {
  bundle: FlowBundle;
  observations: StrategicObservation[];
  gitContext: GitContextFile | null;
}

export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Load manifest listing flow JSON paths, then merge bundles */
export async function loadWorkspace(
  assetBase: string,
  opts?: { gitFile?: string }
): Promise<LoadedWorkspace> {
  const base = assetBase.replace(/\/$/, "");
  const gitFile = opts?.gitFile ?? "git-context.json";
  const manifest = await fetchJson<{ files: string[] }>(`${base}/manifest.json`);
  const bundles: FlowBundle[] = [];
  if (manifest?.files?.length) {
    for (const f of manifest.files) {
      const url = f.startsWith("http") ? f : `${base}/${f.replace(/^\//, "")}`;
      const b = await fetchJson<FlowBundle>(url);
      if (b?.flows?.length && b.steps) bundles.push(b);
    }
  } else {
    const single = await fetchJson<FlowBundle>(`${base}/flows.json`);
    if (single?.flows?.length && single.steps) bundles.push(single);
  }

  const merged = mergeBundles(bundles);
  const obsFile = await fetchJson<{ strategic_observations?: StrategicObservation[] }>(
    `${base}/strategic-observations.json`
  );
  const observations = obsFile?.strategic_observations ?? (Array.isArray(obsFile) ? (obsFile as StrategicObservation[]) : []);

  const gitContext = await fetchJson<GitContextFile>(`${base}/${gitFile}`);

  return {
    bundle: merged,
    observations: Array.isArray(observations) ? observations : [],
    gitContext,
  };
}

function mergeBundles(parts: FlowBundle[]): FlowBundle {
  if (!parts.length) return { version: 1, flows: [], steps: {} };
  const steps: Record<string, import("./types").Step> = {};
  const flows: import("./types").Flow[] = [];
  for (const p of parts) {
    flows.push(...p.flows);
    Object.assign(steps, p.steps);
  }
  return { version: 1, flows, steps };
}
