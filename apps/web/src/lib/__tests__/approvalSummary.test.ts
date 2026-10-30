import { describe, expect, it } from 'vitest';
import { approvalSummary } from '../approvalSummary';

describe('approvalSummary', () => {
  it('reads the verdicts, files and latest output out of the run variables', () => {
    const summary = approvalSummary({
      message: 'Deliverables are ready',
      context: {
        variables: { qa_approved: true, qc_passed: false, testCoverage: 66.6, failingUseCases: ['UC-002'], filesWritten: ['a.ts', 'b.ts'], output: 'x'.repeat(700) },
      },
    });
    expect(summary.message).toBe('Deliverables are ready');
    expect(summary.facts).toEqual([
      { label: 'QA review', value: 'Approved', tone: 'good' },
      { label: 'QC tests', value: 'Failed (67% use-case coverage)', tone: 'bad' },
      { label: 'Failing use cases', value: 'UC-002', tone: 'bad' },
      { label: 'Files written', value: '2' },
    ]);
    expect(summary.excerpt).toHaveLength(601);
  });

  it('has a default message and no facts for an empty request', () => {
    expect(approvalSummary(undefined)).toEqual({ message: 'Approval required to continue the workflow.', facts: [], excerpt: undefined });
  });
});
