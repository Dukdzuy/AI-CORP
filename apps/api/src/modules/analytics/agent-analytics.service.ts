import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgentAnalytics,
  AgentAnomaly,
  AgentAnomalyDetector,
  AgentPerformanceAnalyzer,
  AnalyticsInput,
  Period,
} from '../../domain/analytics';
import { stepOutputFields } from './step-output';

export interface AgentAnalyticsQuery {
  days?: number;
  projectId?: string;
}

export interface AgentAnalyticsView extends AgentAnalytics {
  anomalies: AgentAnomaly[];
}

/** Roles whose step output carries a verdict or prediction the analyzer reads */
const ROLES_WITH_SIGNALS = ['DEV', 'QA', 'QC'];

/**
 * Agent performance analytics (Phase 6, Task 24): loads two periods of history and lets
 * the domain analyzer and anomaly detector compute everything.
 *
 * @pattern Query Service (CQRS read side)
 */
@Injectable()
export class AgentAnalyticsService {
  private readonly analyzer = new AgentPerformanceAnalyzer();
  private readonly detector = new AgentAnomalyDetector();

  constructor(private readonly prisma: PrismaService) {}

  async analytics(query: AgentAnalyticsQuery = {}, now = new Date()): Promise<AgentAnalyticsView> {
    const days = query.days ?? 30;
    const period: Period = { start: new Date(now.getTime() - days * 86_400_000), end: new Date(now.getTime() + 1) };
    const input = await this.load(period, query.projectId);
    const analytics = this.analyzer.analyze(input, period, now);
    return { ...analytics, anomalies: this.detector.detect(analytics.roles) };
  }

  /** History of the period and the one before it (trend and anomaly baseline) */
  private async load(period: Period, projectId?: string): Promise<AnalyticsInput> {
    const since = new Date(2 * period.start.getTime() - period.end.getTime());
    const projectFilter = projectId ? { workflowRun: { projectId } } : {};
    const [steps, signalSteps, usage, gates] = await Promise.all([
      this.prisma.workflowStep.findMany({
        where: { agentRole: { not: null }, startedAt: { gte: since }, ...projectFilter },
        select: { id: true, agentRole: true, nodeId: true, status: true, durationMs: true, retryCount: true, startedAt: true, workflowRunId: true },
      }),
      // Outputs can be large (code), so only the roles with a verdict are read with them
      this.prisma.workflowStep.findMany({
        where: { agentRole: { in: ROLES_WITH_SIGNALS }, startedAt: { gte: since }, ...projectFilter },
        select: { id: true, output: true },
      }),
      this.prisma.apiUsageLog.findMany({
        where: { createdAt: { gte: since }, ...(projectId ? { projectId } : {}) },
        select: { agentRole: true, actualCost: true, createdAt: true },
      }),
      this.prisma.qualityGateLog.findMany({
        where: { timestamp: { gte: since }, ...(projectId ? { projectId } : {}) },
        select: { passed: true, timestamp: true },
      }),
    ]);

    const outputs = new Map(signalSteps.map(s => [s.id, stepOutputFields(s.output)]));
    return {
      steps: steps.map(s => {
        const fields = outputs.get(s.id) ?? {};
        return {
          agentRole: s.agentRole!,
          nodeId: s.nodeId,
          status: s.status,
          durationMs: s.durationMs,
          retryCount: s.retryCount,
          startedAt: s.startedAt!,
          workflowRunId: s.workflowRunId,
          verdict: { qaApproved: fields.qaApproved, qcPassed: fields.qcPassed },
          predictedQaVerdict: fields.predictedQaVerdict,
        };
      }),
      usage: usage.map(u => ({ agentRole: u.agentRole, cost: Number(u.actualCost), createdAt: u.createdAt })),
      gates,
    };
  }
}
