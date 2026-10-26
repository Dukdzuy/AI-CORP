import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectWorkspace } from '../workspace/project-workspace.service';
import { EventBus } from '../../domain/events/EventBus';
import { ReportGeneratedEvent } from '../../domain/events/ReportGeneratedEvent';
import { CostReport, PerformanceReport, isoWeekKey } from '../../domain/reporting';
import { ProjectReportingService } from './project-reporting.service';

export interface WeeklyRunResult {
  period: string;
  generated: Array<{ projectId: string; path: string }>;
  skipped: number;
}

/**
 * Weekly project report (Phase 5, Task 23; re-scoped from "e-mail every Monday").
 *
 * Every tick (REPORT_SCHEDULER_INTERVAL_MINUTES, default 60; 0 disables it) each active
 * project gets `reports/weekly-<ISO week>.md` in its workspace if this week's file is
 * missing, and a ReportGeneratedEvent is raised (audit trail + `report.generated` webhook).
 * The file name makes the job idempotent: restarts and extra ticks never duplicate a report.
 * There is no mail server in the platform; the webhook is the delivery channel.
 */
@Injectable()
export class WeeklyReportScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WeeklyReportScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ProjectReportingService,
    private readonly workspace: ProjectWorkspace,
    private readonly eventBus: EventBus,
    private readonly config: ConfigService
  ) {}

  onApplicationBootstrap() {
    const minutes = Number(this.config.get('REPORT_SCHEDULER_INTERVAL_MINUTES', 60));
    if (!minutes || minutes <= 0) return;
    this.timer = setInterval(() => void this.runOnce().catch(e => this.logger.error(`Weekly report run failed: ${e.message}`)), minutes * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now = new Date()): Promise<WeeklyRunResult> {
    const period = isoWeekKey(now);
    if (this.running) return { period, generated: [], skipped: 0 };
    this.running = true;
    try {
      const projects = await this.prisma.project.findMany({ where: { status: 'active' }, select: { id: true, name: true } });
      const result: WeeklyRunResult = { period, generated: [], skipped: 0 };
      for (const project of projects) {
        const path = `reports/weekly-${period}.md`;
        if (await this.workspace.exists(project.id, path)) {
          result.skipped++;
          continue;
        }
        const [cost, performance, status] = await Promise.all([
          this.reporting.costReport(project.id),
          this.reporting.performanceReport({ projectId: project.id, days: 7 }),
          this.reporting.status(project.id),
        ]);
        await this.workspace.writeFile(project.id, path, WeeklyReportScheduler.markdown(project.name, period, now, cost, performance, status));
        await this.eventBus
          .publish(new ReportGeneratedEvent(project.id, period, path, cost.total))
          .catch(e => this.logger.error(`ReportGeneratedEvent not published: ${e.message}`));
        result.generated.push({ projectId: project.id, path });
      }
      if (result.generated.length) this.logger.log(`Weekly reports ${period}: ${result.generated.length} written`);
      return result;
    } finally {
      this.running = false;
    }
  }

  static markdown(
    name: string,
    period: string,
    now: Date,
    cost: CostReport,
    perf: PerformanceReport,
    status: { status: string; tasks: Record<string, number>; workflow: { status: string; currentNodeId: string | null } | null; traceabilityCoverage: number | null }
  ): string {
    const rows = (items: string[][]) => items.map(r => `| ${r.join(' | ')} |`).join('\n');
    return [
      `# Weekly report — ${name} (${period})`,
      '',
      `Generated ${now.toISOString()} by the AI Corp report scheduler.`,
      '',
      '## Status',
      '',
      `- Project: **${status.status}**; workflow: ${status.workflow ? `${status.workflow.status} at \`${status.workflow.currentNodeId ?? '-'}\`` : 'not started'}`,
      `- Tasks: ${Object.entries(status.tasks).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`,
      `- Traceability coverage: ${status.traceabilityCoverage !== null ? `${Math.round(status.traceabilityCoverage)}%` : 'not measured'}`,
      '',
      '## Cost (project to date)',
      '',
      `Total **$${cost.total.toFixed(4)}** over ${cost.calls} LLM calls${cost.budgetUsed !== null ? `, ${(cost.budgetUsed * 100).toFixed(1)}% of the $${cost.budget} budget` : ''}.`,
      '',
      '| Agent | Calls | Tokens | Cost (USD) |',
      '|-------|------:|-------:|-----------:|',
      rows(cost.byAgent.map(b => [b.key, String(b.calls), String(b.tokens), b.cost.toFixed(4)])) || '| – | 0 | 0 | 0 |',
      '',
      '## Agent performance (last 7 days)',
      '',
      '| Role / node | Runs | Success | Avg ms |',
      '|-------------|-----:|--------:|-------:|',
      rows(perf.byRole.map(r => [r.role, String(r.executions), r.successRate === null ? "–" : `${Math.round(r.successRate * 100)}%`, String(r.avgDurationMs)])) || '| – | 0 | – | – |',
      '',
    ].join('\n');
  }
}
