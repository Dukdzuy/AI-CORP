import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EstimationModel,
  Forecast,
  ForecastComparison,
  ITaskCostEstimator,
  RoleModelSummary,
  compareForecast,
} from '../../domain/estimation';
import { TrainingDataCollector, descriptionLength, useCaseCount } from './training-data.collector';

/** Roles whose work is implementing and verifying the planned tasks */
const IMPLEMENTATION_ROLES = ['DEV', 'QC', 'QA'];

export interface StoredForecast {
  id: string;
  stage: string;
  createdAt: string;
  durationMs: number;
  cost: number;
  confidence: string;
}

export interface ProjectEstimateView {
  projectId: string;
  current: Forecast;
  history: StoredForecast[];
  /** Agent working time and LLM cost so far */
  actual: { durationMs: number; cost: number; finished: boolean };
  /** First stored forecast against the outcome, once the run completed */
  comparison: (ForecastComparison & { stage: string }) | null;
}

export interface EstimationModelView {
  trainingProjects: number;
  minRegressionSamples: number;
  roles: RoleModelSummary[];
  /** Completed projects that had a forecast: how far off it was */
  accuracy: Array<ForecastComparison & { projectId: string; projectName: string; stage: string }>;
  meanAbsoluteDurationError: number | null;
  meanAbsoluteCostError: number | null;
}

/**
 * Effort and cost forecasts (Phase 6, Task 25).
 *
 * The model is retrained from the history on demand; the trained model is reused until a
 * new run completes (no weekly cron, so the model never lags behind the data).
 * Forecasts are stored when a workflow starts and when the PM plans the tasks, so they
 * can be compared with the outcome later.
 *
 * @pattern Application Service, Adapter (implements the ITaskCostEstimator port)
 */
@Injectable()
export class ProjectEstimationService implements ITaskCostEstimator {
  private readonly logger = new Logger(ProjectEstimationService.name);
  private cached: { key: string; model: EstimationModel } | null = null;

  constructor(private readonly prisma: PrismaService, private readonly collector: TrainingDataCollector) {}

  async model(): Promise<EstimationModel> {
    const [count, last] = await Promise.all([
      this.prisma.workflowRun.count({ where: { parentRunId: null, status: 'completed' } }),
      this.prisma.workflowRun.findFirst({ where: { parentRunId: null, status: 'completed' }, orderBy: { completedAt: 'desc' }, select: { completedAt: true } }),
    ]);
    const key = `${count}|${last?.completedAt?.toISOString() ?? ''}`;
    if (this.cached?.key !== key) {
      this.cached = { key, model: EstimationModel.train(await this.collector.collect()) };
    }
    return this.cached.model;
  }

  async forecast(projectId: string): Promise<Forecast> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { description: true, goal: true, ooadMetadata: true, workflowRuns: { where: { parentRunId: null }, orderBy: { startedAt: 'desc' }, take: 1, select: { workflowDefId: true } } },
    });
    if (!project) throw new NotFoundException(`Project with ID ${projectId} not found.`);
    const model = await this.model();
    const roles = model.rolesFor(project.workflowRuns[0]?.workflowDefId ?? null);
    return model.forecast({ descriptionLength: descriptionLength(project), useCaseCount: useCaseCount(project.ooadMetadata) }, roles);
  }

  /** Stores the current forecast; returns null when there is no history to forecast from */
  async record(projectId: string, stage: 'start' | 'planned'): Promise<Forecast | null> {
    const forecast = await this.forecast(projectId);
    if (!forecast.byRole.length) return null;
    await this.prisma.projectEstimate.create({
      data: {
        projectId,
        stage,
        predictedDurationMs: forecast.durationMs,
        predictedCost: forecast.cost,
        confidence: forecast.confidence,
        detail: { byRole: forecast.byRole, features: forecast.features, imputed: forecast.imputed, unknownRoles: forecast.unknownRoles, trainingProjects: forecast.trainingProjects } as any,
      },
    });
    return forecast;
  }

  /** ITaskCostEstimator: implementation + verification cost shared by the planned tasks */
  async estimateTaskCost(projectId: string, taskCount: number): Promise<number | null> {
    if (taskCount <= 0) return null;
    try {
      const forecast = await this.record(projectId, 'planned');
      if (!forecast) return null;
      const cost = forecast.byRole.filter(r => IMPLEMENTATION_ROLES.includes(r.role)).reduce((s, r) => s + r.cost, 0);
      return cost > 0 ? Math.round((cost / taskCount) * 100) / 100 : null;
    } catch (err: any) {
      this.logger.warn(`Task estimation skipped for project ${projectId}: ${err.message}`);
      return null;
    }
  }

  async projectEstimate(projectId: string): Promise<ProjectEstimateView> {
    const current = await this.forecast(projectId);
    const [stored, actual] = await Promise.all([
      this.prisma.projectEstimate.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
      this.actual(projectId),
    ]);
    const history = stored.map(e => ({
      id: e.id,
      stage: e.stage,
      createdAt: e.createdAt.toISOString(),
      durationMs: e.predictedDurationMs,
      cost: Number(e.predictedCost),
      confidence: e.confidence,
    }));
    const first = history[0];
    return {
      projectId,
      current,
      history,
      actual,
      comparison: actual.finished && first ? { stage: first.stage, ...compareForecast(first, actual) } : null,
    };
  }

  async modelView(): Promise<EstimationModelView> {
    const model = await this.model();
    const estimates = await this.prisma.projectEstimate.findMany({
      orderBy: { createdAt: 'asc' },
      select: { projectId: true, stage: true, predictedDurationMs: true, predictedCost: true, project: { select: { name: true } } },
    });
    const firstByProject = new Map<string, (typeof estimates)[number]>();
    for (const e of estimates) if (!firstByProject.has(e.projectId)) firstByProject.set(e.projectId, e);

    const accuracy: EstimationModelView['accuracy'] = [];
    for (const e of firstByProject.values()) {
      const actual = await this.actual(e.projectId);
      if (!actual.finished) continue;
      accuracy.push({
        projectId: e.projectId,
        projectName: e.project.name,
        stage: e.stage,
        ...compareForecast({ durationMs: e.predictedDurationMs, cost: Number(e.predictedCost) }, actual),
      });
    }
    const meanAbs = (xs: Array<number | null>) => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? Math.round((v.reduce((s, x) => s + Math.abs(x), 0) / v.length) * 10_000) / 10_000 : null;
    };
    return {
      trainingProjects: model.trainingProjects,
      minRegressionSamples: model.options.minRegressionSamples,
      roles: model.summary(),
      accuracy,
      meanAbsoluteDurationError: meanAbs(accuracy.map(a => a.durationError)),
      meanAbsoluteCostError: meanAbs(accuracy.map(a => a.costError)),
    };
  }

  /** Agent working time and LLM cost of the project; finished once the latest run completed */
  private async actual(projectId: string): Promise<{ durationMs: number; cost: number; finished: boolean }> {
    const [steps, cost, run] = await Promise.all([
      this.prisma.workflowStep.aggregate({ where: { agentRole: { not: null }, workflowRun: { projectId } }, _sum: { durationMs: true } }),
      this.prisma.apiUsageLog.aggregate({ where: { projectId }, _sum: { actualCost: true } }),
      this.prisma.workflowRun.findFirst({ where: { projectId, parentRunId: null }, orderBy: { startedAt: 'desc' }, select: { status: true } }),
    ]);
    return {
      durationMs: steps._sum.durationMs ?? 0,
      cost: Number(cost._sum.actualCost ?? 0),
      finished: run?.status === 'completed',
    };
  }
}
