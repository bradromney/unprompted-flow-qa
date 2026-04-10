export interface Flow {
  id: string;
  title: string;
  tags?: string[];
  steps: string[];
  fixtures?: string[];
  segment?: string;
  jtbd?: string;
  assumptions_tested?: string[];
  strategic_intent?: string;
  eval_dimension?: "ux" | "strategy" | "alignment" | "business_model";
}

export interface Step {
  id: string;
  urlPattern: string;
  type?: "glob" | "regex";
  selector?: string;
  instructions?: string;
  stateHints?: Record<string, unknown>;
  expected_emotion?: string;
  success_looks_like?: string;
  failure_signal?: string;
  assumption_dependency?: string;
}

export type IssueType =
  | "bug"
  | "ux_friction"
  | "strategic_gap"
  | "assumption_evidence";

export type EvidenceDirection = "supports" | "contradicts" | "ambiguous";

export interface Issue {
  id: string;
  flowId: string;
  stepId: string;
  notes: string;
  screenshot: string;
  componentName?: string;
  selector?: string;
  patternBreadth?: number;
  timestamp: number;
  type: IssueType;
  evidence_direction?: EvidenceDirection;
  strategic_note?: string;
  severity?: "critical" | "major" | "minor" | "observation";
}

export interface StrategicObservation {
  observation: string;
  type: string;
  suggested_assumption?: string;
}

export interface FlowBundle {
  version?: number;
  flows: Flow[];
  steps: Record<string, Step>;
}

export interface RouteConfigEntry {
  /** Route pattern as used in router, e.g. /pipeline/:id */
  path: string;
  /** Source file path relative to repo root, e.g. src/pages/Pipeline.tsx */
  file: string;
}

export interface RouteConfig {
  routes: RouteConfigEntry[];
}

export interface GitContextFile {
  base: string;
  changedFiles: string[];
  generatedAt: string;
}

export interface StepCorrection {
  flowId: string;
  stepId: string;
  matchedPathname: string;
  matchedSelector?: string;
  recordedAt: number;
}

export type ViewportPreset = "375" | "414" | "768" | "full";

export interface MountFlowQAOptions {
  /** Required: maps routes to source files for git → flow suggestions */
  routeConfig: RouteConfig;
  getLocation: () => { pathname: string; search: string };
  /**
   * When false, Flow QA does not load assets, register shortcuts, or show UI (host can toggle after auth).
   * @default true
   */
  enabled?: boolean;
  subscribeLocation?: (cb: () => void) => () => void;
  /** Base URL for fetching /flow-qa/* static assets (default: "") */
  flowQaAssetBase?: string;
  /** Filename relative to flowQaAssetBase (default `git-context.json`) */
  gitContextPath?: string;
  /** Repo root-relative path for grep (default cwd from vite — host should pass import.meta.url derived root if needed) */
  repoRoot?: string;
  /** Optional: run grep for component pattern breadth */
  grepCommand?: "client" | "skip";
}
