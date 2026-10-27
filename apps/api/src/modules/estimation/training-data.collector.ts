import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstimationSample } from '../../domain/estimation';

/** Description + goal length of a project: the size of the request the agents work from */
export const descriptionLength = (p: { description: string; goal: string }) => (p.description?.length ?? 0) + (p.goal?.length ?? 0);

export const useCaseCount = (ooadMetadata: unknown): number | null => {
  const useCases = (ooadMetadata as any)?.useCases;
  return Array.isArray(useCases) && useCases.length ? useCases.length : null;
};

/**
 * Builds estimation samples from finished projects (Phase 6, Task 25): one sample per
 * project and agent role, with the role's summed step duration (all runs, sub-workflows
 * included) and its LLM cost.
 *
 * Only projects whose latest top-level run completed are used, so an aborted run does
 * not teach the model that projects are cheap.
 */
@Injectable()
export class TrainingDataCollector {
  constructor(private readonly prisma: PrismaService) {}

  async collect(): Promise<EstimationSample[]> {
    const runs = await this.prisma.workflowRun.findMany({
      where: { parentRunId: null },
      orderBy: { startedAt: 'desc' },
      select: { projectId: true, status: true, workflowDefId: true },
    });
    const latest = new Map<string, { status: string; workflowDefId: string }>();
    for (const r of runs) if (!latest.has(r.projectId)) latest.set(r.projectId, r);
    const finished = [...latest.entries()].filter(([, r]) => r.status === 'completed');
    if (!finished.length) return [];
    const ids = finished.map(([id]) => id);

    const [projects, durations, costs] = await Promise.all([
      this.prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, description: true, goal: true, ooadMetadata: true } }),
      this.prisma.workflowStep.findMany({
        where: { agentRole: { not: null }, durationMs: { not: null }, workflowRun: { projectId: { in: ids } } },
        select: { agentRole: true, durationMs: true, workflowRun: { select: { projectId: true } } },
      }),
      this.prisma.apiUsageLog.groupBy({ by: ['projectId', 'agentRole'], where: { projectId: { in: ids } }, _sum: { actualCost: true } }),
    ]);

    const work = new Map<string, { durationMs: number; cost: number }>();
    const entry = (projectId: string, role: string) => {
      const key = `${projectId}|${role}`;
      if (!work.has(key)) work.set(key, { durationMs: 0, cost: 0 });
      return work.get(key)!;
    };
    for (const s of durations) entry(s.workflowRun.projectId, s.agentRole!).durationMs += s.durationMs ?? 0;
    for (const c of costs) if (c.projectId) entry(c.projectId, c.agentRole).cost += Number(c._sum.actualCost ?? 0);

    const byId = new Map(projects.map(p => [p.id, p]));
    const samples: EstimationSample[] = [];
    for (const [key, w] of work) {
      const [projectId, role] = key.split('|');
      const project = byId.get(projectId);
      if (!project || w.durationMs <= 0) continue; // usage without a step (e.g. a deleted run) is not a sample
      samples.push({
        projectId,
        role,
        workflowDefId: latest.get(projectId)!.workflowDefId,
        features: { descriptionLength: descriptionLength(project), useCaseCount: useCaseCount(project.ooadMetadata) ?? 0 },
        durationMs: w.durationMs,
        cost: w.cost,
      });
    }
    return samples;
  }
}
