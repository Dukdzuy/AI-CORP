import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectWorkspace } from '../workspace/project-workspace.service';
import {
  CostReport,
  CostReportBuilder,
  PerformanceReport,
  PerformanceReportBuilder,
  ProjectExportSnapshot,
} from '../../domain/reporting';

export interface ProjectStatusView {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  workflow: {
    runId: string;
    definition: string;
    status: string;
    currentNodeId: string | null;
    startedAt: string;
    completedAt: string | null;
    stepsCompleted: number;
    stepsFailed: number;
  } | null;
  tasks: Record<string, number>;
  cost: { accrued: number; budget: number | null; budgetUsed: number | null };
  qualityGate: { gateId: string; passed: boolean; at: string } | null;
  traceabilityCoverage: number | null;
  pendingApprovals: number;
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/**
 * Read side for reports, exports and the integration status endpoint (Phase 5, Task 23).
 * It only queries; the numbers are computed by the domain builders.
 *
 * @pattern Query Service (CQRS read side), Facade over Prisma + workspace
 */
@Injectable()
export class ProjectReportingService {
  constructor(private readonly prisma: PrismaService, private readonly workspace: ProjectWorkspace) {}

  async costReport(projectId: string): Promise<CostReport> {
    const project = await this.requireProject(projectId);
    const logs = await this.prisma.apiUsageLog.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    return CostReportBuilder.build(
      projectId,
      logs.map(l => ({
        agentRole: l.agentRole,
        model: l.actualModelUsed,
        cost: num(l.actualCost),
        totalTokens: l.totalTokens,
        responseTimeMs: l.responseTimeMs,
        fallback: l.isFallbackTriggered,
        createdAt: l.createdAt,
      })),
      project.budget !== null ? num(project.budget) : null
    );
  }

  async performanceReport(filter: { projectId?: string; role?: string; days?: number } = {}): Promise<PerformanceReport> {
    if (filter.projectId) await this.requireProject(filter.projectId);
    const since = filter.days ? new Date(Date.now() - filter.days * 86_400_000) : undefined;
    const steps = await this.prisma.workflowStep.findMany({
      where: {
        ...(filter.projectId ? { workflowRun: { projectId: filter.projectId } } : {}),
        ...(filter.role ? { agentRole: filter.role.toUpperCase() } : {}),
        ...(since ? { startedAt: { gte: since } } : {}),
      },
      select: { agentRole: true, nodeId: true, status: true, durationMs: true, retryCount: true },
    });
    return PerformanceReportBuilder.build(filter.projectId ?? null, steps);
  }

  async status(projectId: string): Promise<ProjectStatusView> {
    const project = await this.requireProject(projectId);
    const [run, taskGroups, gate, pendingApprovals] = await Promise.all([
      this.prisma.workflowRun.findFirst({
        where: { projectId, parentRunId: null },
        orderBy: { startedAt: 'desc' },
        include: { steps: { select: { status: true } } },
      }),
      this.prisma.task.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
      this.prisma.qualityGateLog.findFirst({ where: { projectId }, orderBy: { timestamp: 'desc' } }),
      this.prisma.approval.count({ where: { status: 'pending', workflowRun: { projectId } } }),
    ]);
    const budget = project.budget !== null ? num(project.budget) : null;
    const accrued = num(project.costAccrued);
    const meta = (project.ooadMetadata as any) ?? {};
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      workflow: run && {
        runId: run.id,
        definition: `${run.workflowDefId}${run.workflowDefVersion ? `@${run.workflowDefVersion}` : ''}`,
        status: run.status,
        currentNodeId: run.currentNodeId,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        stepsCompleted: run.steps.filter(s => s.status === 'completed').length,
        stepsFailed: run.steps.filter(s => s.status === 'failed').length,
      },
      tasks: Object.fromEntries(taskGroups.map(g => [g.status, g._count._all])),
      cost: { accrued, budget, budgetUsed: budget ? Math.round((accrued / budget) * 10_000) / 10_000 : null },
      qualityGate: gate && { gateId: gate.gateId, passed: gate.passed, at: gate.timestamp.toISOString() },
      traceabilityCoverage: typeof meta.testCoverage === 'number' ? meta.testCoverage : null,
      pendingApprovals,
    };
  }

  /** Everything an export contains, gathered once */
  async snapshot(projectId: string, exportedBy: string): Promise<ProjectExportSnapshot> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        createdBy: { select: { email: true } },
        milestones: { orderBy: { createdAt: 'asc' } },
        tasks: { orderBy: { createdAt: 'asc' }, include: { milestone: { select: { name: true } } } },
        workflowRuns: { where: { parentRunId: null }, orderBy: { startedAt: 'asc' }, include: { _count: { select: { steps: true } } } },
        qualityGateLogs: { orderBy: { timestamp: 'asc' } },
      },
    });
    if (!project) throw new NotFoundException(`Project with ID ${projectId} not found.`);
    const [cost, performance, files] = await Promise.all([
      this.costReport(projectId),
      this.performanceReport({ projectId }),
      this.workspace.listFiles(projectId).catch(() => [] as string[]),
    ]);
    const meta = (project.ooadMetadata as any) ?? {};

    return {
      exportedAt: new Date().toISOString(),
      exportedBy,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        goal: project.goal,
        status: project.status,
        budget: project.budget !== null ? num(project.budget) : null,
        costAccrued: num(project.costAccrued),
        createdAt: project.createdAt.toISOString(),
        owner: project.createdBy.email,
      },
      milestones: project.milestones.map(m => ({ id: m.id, title: m.name, status: m.status, dueDate: m.dueDate?.toISOString() ?? null })),
      tasks: project.tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedAgent: t.assignedAgent ?? null,
        milestone: t.milestone?.name ?? null,
        actualCost: num(t.actualCost),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      workflowRuns: project.workflowRuns.map(r => ({
        id: r.id,
        definition: `${r.workflowDefId}${r.workflowDefVersion ? `@${r.workflowDefVersion}` : ''}`,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        steps: r._count.steps,
      })),
      qualityGates: project.qualityGateLogs.map(g => ({ gateId: g.gateId, passed: g.passed, at: g.timestamp.toISOString() })),
      ooad: {
        useCases: Array.isArray(meta.useCases) ? meta.useCases.length : 0,
        traceabilityCoverage: typeof meta.testCoverage === 'number' ? meta.testCoverage : null,
        artifacts: files.length,
      },
      cost,
      performance,
    };
  }

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project with ID ${projectId} not found.`);
    return project;
  }
}
