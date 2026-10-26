import { AgentRole } from '@ai-corp/shared-types';
import { AgentCompletedTaskEvent } from '../../domain/events/AgentCompletedTaskEvent';
import { QualityGateEvaluatedEvent } from '../../domain/events/QualityGateEvaluatedEvent';
import { ExecutionOutcome } from '../../domain/agent/learning/ExecutionOutcome';

/**
 * OutcomeSignalPolicy
 *
 * Decides which earlier executions a quality signal grades (pure, no I/O):
 * - OOAD gate result → BA (use cases) and ARCHITECT (design)
 * - QC completion (qc_passed, coverage, failing use cases) → DEV
 * - QA completion (qa_approved) → DEV and QC
 * Signals for unknown projects are ignored, as are executions that produce no signal.
 */
export class OutcomeSignalPolicy {
  static readonly GATE_GRADES: AgentRole[] = [AgentRole.BA, AgentRole.ARCHITECT];

  fromGate(event: QualityGateEvaluatedEvent): ExecutionOutcome[] {
    if (!this.knownProject(event.projectId)) return [];
    return OutcomeSignalPolicy.GATE_GRADES.map(role => ({
      role,
      projectId: event.projectId,
      signal: 'ooad_gate' as const,
      success: event.passed,
      score: event.score,
      details: event.failedChecks,
      source: event.gateId,
    }));
  }

  fromAgentCompleted(event: AgentCompletedTaskEvent): ExecutionOutcome[] {
    if (!this.knownProject(event.projectId)) return [];
    const action = event.result?.action;
    const output = action?.output;
    if (!action?.success || !output || typeof output !== 'object') return [];

    if (event.agentId === AgentRole.QC && typeof output.qc_passed === 'boolean') {
      const details: string[] = [];
      if (output.failingUseCases?.length) details.push(`failing use cases ${output.failingUseCases.join(', ')}`);
      if (output.missingUseCases?.length) details.push(`untested use cases ${output.missingUseCases.join(', ')}`);
      if (Array.isArray(output.failingTests)) details.push(...output.failingTests.slice(0, 3));
      if (output.testsExecuted === false) details.push('tests were not executed');
      return [{
        role: AgentRole.DEV,
        projectId: event.projectId,
        signal: 'qc_verification',
        success: output.qc_passed,
        score: typeof output.testCoverage === 'number' ? output.testCoverage : undefined,
        details,
        source: AgentRole.QC,
      }];
    }

    if (event.agentId === AgentRole.QA && typeof output.qa_approved === 'boolean') {
      const findings = OutcomeSignalPolicy.findings(String(output.output || ''));
      return [AgentRole.DEV, AgentRole.QC].map(role => ({
        role,
        projectId: event.projectId,
        signal: 'qa_review' as const,
        success: output.qa_approved,
        details: findings,
        source: AgentRole.QA,
      }));
    }

    return [];
  }

  /** The first few non-empty review lines, without the verdict line */
  static findings(review: string, max = 3): string[] {
    return review
      .split('\n')
      .map(l => l.replace(/^[\s*#>-]+|\d+\.\s+/g, '').trim())
      .filter(l => l.length > 10 && !/^VERDICT:/i.test(l))
      .slice(0, max)
      .map(l => l.slice(0, 200));
  }

  private knownProject(projectId: string | undefined): boolean {
    return !!projectId && projectId !== 'unknown';
  }
}
