/**
 * ExecutionOutcome (value object)
 *
 * How one agent execution turned out, judged by the quality signal the workflow produces
 * after it:
 * - ooad_gate: the OOAD quality gate grades the BA's use cases and the Architect's design
 * - qc_verification: QC's executed acceptance tests grade DEV's implementation
 * - qa_review: QA's verdict grades DEV's implementation and QC's verification
 *
 * Outcomes are stored as memories (namespace execution_outcomes) and refined into lessons.
 */
export type OutcomeSignal = 'ooad_gate' | 'qc_verification' | 'qa_review';

export const EXECUTION_OUTCOMES_NAMESPACE = 'execution_outcomes';

export interface ExecutionOutcome {
  /** Role whose execution is graded */
  role: string;
  projectId: string;
  signal: OutcomeSignal;
  success: boolean;
  /** 0-100 when the signal has a score (gate score, coverage) */
  score?: number;
  /** Short, human-readable reason, e.g. failed checks or failing use cases */
  details: string[];
  /** The role that produced the signal (QC, QA) or the gate id */
  source: string;
}

/** One line for the memory content and the refinement prompt */
export function describeOutcome(outcome: ExecutionOutcome): string {
  const verdict = outcome.success ? 'SUCCESS' : 'FAILURE';
  const score = outcome.score !== undefined ? ` (score ${outcome.score}%)` : '';
  const details = outcome.details.length ? `: ${outcome.details.slice(0, 5).join('; ')}` : '';
  return `${verdict} ${outcome.signal} from ${outcome.source}${score} on project ${outcome.projectId}${details}`;
}
