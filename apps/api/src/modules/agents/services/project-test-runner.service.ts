import { Injectable, Logger } from '@nestjs/common';
import { ResourceLimits } from '@ai-corp/shared-types';
import { SandboxExecutor, WorkspaceRunOptions } from '../../tools/sandbox.executor';
import { ProjectWorkspace } from '../../workspace/project-workspace.service';
import { JestJsonReport, JestReportMapper, TestExecutionSummary } from './jest-report.mapper';
import { TraceUseCase } from './traceability.service';

/**
 * ProjectTestRunner
 *
 * Runs a generated project's Jest suite through SandboxExecutor.runInWorkspace (read-only
 * mount of projects/<id>, writable tmpfs, no network unless a registry is configured) and
 * maps the JSON report onto use cases for the traceability matrix.
 *
 * The report is printed after a marker instead of being written to the workspace, so the
 * run never changes the project folder and works the same in Docker and in the local fallback.
 */
@Injectable()
export class ProjectTestRunner {
  static readonly REPORT_MARKER = '@@AI_CORP_JEST_REPORT@@';
  static readonly REPORT_FILE = '.ai-corp-jest-report.json';

  private readonly logger = new Logger(ProjectTestRunner.name);
  private readonly mapper = new JestReportMapper();

  constructor(
    private readonly sandbox: SandboxExecutor,
    private readonly workspace: ProjectWorkspace
  ) {}

  /** Shell command run inside the copy of the project (exported for tests) */
  static command(): string {
    const report = ProjectTestRunner.REPORT_FILE;
    return [
      'if [ ! -d node_modules ]; then npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1; fi',
      `node_modules/.bin/jest --json --outputFile=${report} --passWithNoTests --ci >/dev/null 2>&1`,
      'status=$?',
      `echo "${ProjectTestRunner.REPORT_MARKER}"`,
      `cat ${report} 2>/dev/null`,
      'exit $status',
    ].join('; ');
  }

  static limits(): ResourceLimits {
    return {
      maxMemoryMB: Number(process.env.QC_TEST_MEMORY_MB) || 1024,
      maxCPUPercent: 100,
      maxDiskMB: Number(process.env.QC_TEST_DISK_MB) || 512,
      timeout: Number(process.env.QC_TEST_TIMEOUT_MS) || 180000,
    };
  }

  /** Extract the Jest JSON that follows the marker in the run's output */
  static parseReport(output: string): JestJsonReport | null {
    const index = output.lastIndexOf(ProjectTestRunner.REPORT_MARKER);
    if (index < 0) return null;
    const json = output.slice(index + ProjectTestRunner.REPORT_MARKER.length).trim();
    if (!json) return null;
    try {
      return JSON.parse(json) as JestJsonReport;
    } catch {
      // Docker log framing can trail the JSON; keep the outermost object
      const end = json.lastIndexOf('}');
      try {
        return end > 0 ? (JSON.parse(json.slice(0, end + 1)) as JestJsonReport) : null;
      } catch {
        return null;
      }
    }
  }

  async run(projectId: string, useCases: TraceUseCase[], options: WorkspaceRunOptions = {}): Promise<TestExecutionSummary> {
    if (process.env.QC_EXECUTE_TESTS === 'false') {
      return JestReportMapper.notExecuted('disabled (QC_EXECUTE_TESTS=false)');
    }
    if (!(await this.workspace.exists(projectId, 'jest.config.js')) || !(await this.workspace.exists(projectId, 'package.json'))) {
      return JestReportMapper.notExecuted('the project has no package.json / jest.config.js');
    }

    try {
      const result = await this.sandbox.runInWorkspace(
        this.workspace.projectDir(projectId),
        ProjectTestRunner.command(),
        ProjectTestRunner.limits(),
        options
      );
      if (result.timedOut) {
        return JestReportMapper.notExecuted(`timed out after ${result.executionTimeMs} ms`, { exitCode: result.exitCode, mode: result.mode });
      }
      const report = ProjectTestRunner.parseReport(result.output);
      if (!report) {
        return JestReportMapper.notExecuted(`no Jest report (exit code ${result.exitCode})`, { exitCode: result.exitCode, mode: result.mode });
      }
      const summary = this.mapper.map(report, useCases);
      this.logger.log(
        `Project ${projectId}: ${summary.passed} passed, ${summary.failed} failed (${result.mode}, ${result.executionTimeMs} ms)`
      );
      return { ...summary, exitCode: result.exitCode, mode: result.mode };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`Project ${projectId}: tests not executed - ${message}`);
      return JestReportMapper.notExecuted(message);
    }
  }
}
