/**
 * Agent Outputs
 *
 * The typed payload each role's action strategy returns in AgentActionResult.output.
 * The workflow engine merges these fields into the run's variables, so later agents and
 * condition nodes read them by name (e.g. code, qcReport, qa_approved).
 *
 * Kept free of framework and schema imports so the domain layer stays independent;
 * the zod-inferred OOAD types in modules/agents/schemas are structurally assignable.
 *
 * @module domain/agent/AgentOutputs
 */

/** Fields every role returns: the task type it performed and a human-readable result */
export interface BaseAgentOutput {
  /** The task type the strategy performed (workflow node taskType, or the role's default) */
  action: string;
  /** Main text result (markdown, code or LLM answer) */
  output: string;
}

export interface CeoOutput extends BaseAgentOutput {
  action: 'planMilestones' | 'complete_project';
}

export interface PmOutput extends BaseAgentOutput {
  action: 'breakdownTasks';
}

export interface BaOutput extends BaseAgentOutput {
  action: 'generateUseCases';
  actors: string[];
  useCases: Array<{ id: string; name: string; actor: string; priority: string }>;
  filesWritten: string[];
}

export interface ArchitectOutput extends BaseAgentOutput {
  action: 'designArchitecture';
  domainModel: { entities: Array<{ name: string }>; [key: string]: unknown };
  patterns: Array<{ name: string; type: string; location: string }>;
  architecture: { style: string; layers: Array<{ name: string }> };
  skeletonFiles: string[];
  filesWritten: string[];
}

export interface DevOutput extends BaseAgentOutput {
  action: 'implement';
  toolOutput: string;
  filesWritten: string[];
  code: string;
}

export interface QcOutput extends BaseAgentOutput {
  action: 'verify';
  qc_passed: boolean;
  testCoverage: number;
  missingUseCases: string[];
  testsWritten: string[];
  qcReport: string;
  /** True when coverage is based on executed tests (Task 12) */
  testsExecuted: boolean;
  /** Use cases whose executed tests fail */
  failingUseCases: string[];
  /** "UC-xxx: <test>: <first failure line>", read by QA */
  failingTests: string[];
}

export interface QaOutput extends BaseAgentOutput {
  action: 'review';
  qa_approved: boolean;
  edgeCondition: 'onSuccess' | 'onFail';
}

export interface MarketingOutput extends BaseAgentOutput {
  action: 'draftAnnouncement';
}

/** DEV's plan, proposed to the Architect before any code is written (pair_develop, Task 15) */
export interface DevPlanOutput extends BaseAgentOutput {
  action: 'planImplementation';
  implementationPlan: string;
  /** "UC-xxx: question" for use cases DEV finds ambiguous (clarification_loop) */
  questions: string[];
}

/** Architect's answer to a DEV plan or implementation (pair_develop navigator) */
export interface ArchitectReviewOutput extends BaseAgentOutput {
  action: 'reviewPlan' | 'reviewCode';
  design_approved: boolean;
  designFeedback: string;
}

/** BA's answer to a clarification REQUEST; the use case is updated in place */
export interface BaClarifyOutput extends BaseAgentOutput {
  action: 'clarifyUseCase';
  clarification: string;
  updatedUseCaseId?: string;
}

export type DevAgentOutput = DevOutput | DevPlanOutput;
export type ArchitectAgentOutput = ArchitectOutput | ArchitectReviewOutput;
export type BaAgentOutput = BaOutput | BaClarifyOutput;

/** Output type per role, for callers that know which role they invoked */
export interface AgentOutputByRole {
  CEO: CeoOutput;
  PM: PmOutput;
  BA: BaAgentOutput;
  ARCHITECT: ArchitectAgentOutput;
  DEV: DevAgentOutput;
  QC: QcOutput;
  QA: QaOutput;
  MARKETING: MarketingOutput;
}
