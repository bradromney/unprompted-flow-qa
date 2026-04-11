export type {
  Flow,
  Step,
  Issue,
  IssueType,
  EvidenceDirection,
  StrategicObservation,
  FlowBundle,
  RouteConfig,
  RouteConfigEntry,
  GitContextFile,
  MountFlowQAOptions,
  ViewportPreset,
  StepCorrection,
} from "./lib/types";

export { FlowQARoot, type FlowQARootProps } from "./react/FlowQARoot";
/** @alias FlowQARoot — plan name for the root wrapper */
export { FlowQARoot as mountFlowQA } from "./react/FlowQARoot";
export type { FlowQARootProps as MountFlowQAProps } from "./react/FlowQARoot";
export { loadWorkspace } from "./lib/loader";
export { matchStepPath, findMatchingStepIds } from "./lib/match-url";
export {
  changedRoutes,
  flowsCoveringChangedRoutes,
  assumptionsForFlows,
} from "./lib/git-map";
export { exportMarkdown, exportJson, buildStrategicSummary } from "./lib/export-report";
export { clusterRelatedIssues } from "./lib/dedupe";
export {
  computeAssumptionHealth,
  computeSegmentCoverage,
  computeStrategySignals,
  computeStrategyState,
  type AssumptionHealth,
  type AssumptionStatus,
  type SegmentCoverage,
  type StrategySignal,
  type StrategyState,
} from "./lib/strategy-inference";
export {
  loadSessionState,
  saveSessionState,
  dwellLabel,
  sessionStats,
  type SessionState,
  type FlowSession,
  type StepEngagement,
} from "./lib/session-tracker";
