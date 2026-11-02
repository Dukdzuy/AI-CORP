/**
 * What a person needs to answer an approval, read out of its requestData (the node's message and
 * the run's variables at that point) instead of the raw JSON the approval cards used to show.
 */
export interface ApprovalSummary {
  message: string;
  facts: { label: string; value: string; tone?: 'good' | 'bad' }[];
  /** The latest agent output (e.g. the marketing announcement), shortened */
  excerpt?: string;
}

const EXCERPT_LENGTH = 600;

export function approvalSummary(requestData: Record<string, unknown> | null | undefined): ApprovalSummary {
  const data = requestData || {};
  const context = (data.context || {}) as Record<string, unknown>;
  const vars = (context.variables || {}) as Record<string, unknown>;
  const facts: ApprovalSummary['facts'] = [];

  if (typeof vars.qa_approved === 'boolean') {
    facts.push({ label: 'QA review', value: vars.qa_approved ? 'Approved' : 'Changes requested', tone: vars.qa_approved ? 'good' : 'bad' });
  }
  if (typeof vars.qc_passed === 'boolean') {
    const coverage = typeof vars.testCoverage === 'number' ? ` (${Math.round(vars.testCoverage)}% use-case coverage)` : '';
    facts.push({ label: 'QC tests', value: `${vars.qc_passed ? 'Passed' : 'Failed'}${coverage}`, tone: vars.qc_passed ? 'good' : 'bad' });
  }
  if (Array.isArray(vars.failingUseCases) && vars.failingUseCases.length > 0) {
    facts.push({ label: 'Failing use cases', value: vars.failingUseCases.join(', '), tone: 'bad' });
  }
  if (Array.isArray(vars.filesWritten)) {
    facts.push({ label: 'Files written', value: String(vars.filesWritten.length) });
  }
  if (typeof vars.approvalFeedback === 'string' && vars.approvalFeedback) {
    facts.push({ label: 'Previous feedback', value: vars.approvalFeedback });
  }

  const output = typeof vars.output === 'string' ? vars.output.trim() : '';
  return {
    message: typeof data.message === 'string' && data.message ? data.message : 'Approval required to continue the workflow.',
    facts,
    excerpt: output ? (output.length > EXCERPT_LENGTH ? `${output.slice(0, EXCERPT_LENGTH)}…` : output) : undefined,
  };
}
