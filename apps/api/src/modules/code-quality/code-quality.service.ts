import { createHash } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProjectWorkspace } from '../workspace/project-workspace.service';
import {
  CODE_ANALYZER,
  CodeQualityAssessment,
  CodeQualityPolicy,
  DEFAULT_QUALITY_THRESHOLD,
  FileMetrics,
  ICodeAnalyzer,
} from '../../domain/quality';

export interface SourceFile {
  path: string;
  content: string;
}

/** Generated source the analysis covers: code under src/, not tests */
const SOURCE = /^src\/.*\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST = /(^|\/)(tests?|__tests__)\/|\.(spec|test)\.[^.]+$/i;
const MAX_FILES = 200;
/** Metrics kept for unchanged files (found by the Task 28 load test: re-parsing on every request blocked the event loop) */
const METRICS_CACHE_SIZE = 2000;
/** A project's assessment is reused for this long unless the DEV agent rewrites its code first */
const PROJECT_CACHE_TTL_MS = 30_000;

export const CODE_QUALITY_REPORT_PATH = 'docs/code-quality.md';

/**
 * Code quality of generated projects (Phase 6, Task 26): analyses files with the
 * ICodeAnalyzer port and scores them with the domain's CodeQualityPolicy.
 *
 * @pattern Application Service, Facade
 */
@Injectable()
export class CodeQualityService {
  private readonly logger = new Logger(CodeQualityService.name);
  readonly policy: CodeQualityPolicy;
  private readonly metricsCache = new Map<string, FileMetrics | null>();
  private readonly projectCache = new Map<string, { at: number; assessment: Promise<CodeQualityAssessment> }>();

  constructor(@Inject(CODE_ANALYZER) private readonly analyzer: ICodeAnalyzer, private readonly workspace: ProjectWorkspace) {
    const threshold = Number(process.env.CODE_QUALITY_MIN_SCORE);
    this.policy = new CodeQualityPolicy(Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_QUALITY_THRESHOLD);
  }

  /** Whether the DEV agent may refine low-scoring code once (CODE_QUALITY_REFINE=off disables it) */
  get refinementEnabled(): boolean {
    return (process.env.CODE_QUALITY_REFINE ?? 'on').toLowerCase() !== 'off';
  }

  static isSource(path: string): boolean {
    return SOURCE.test(path) && !TEST.test(path);
  }

  metrics(files: readonly SourceFile[]): FileMetrics[] {
    return files
      .filter(f => CodeQualityService.isSource(f.path))
      .map(f => this.analyze(f))
      .filter((m): m is FileMetrics => m !== null);
  }

  /** Analysis is pure in (path, content), so a file that did not change is not parsed again */
  private analyze(file: SourceFile): FileMetrics | null {
    const key = createHash('sha1').update(file.path).update('\0').update(file.content).digest('hex');
    if (this.metricsCache.has(key)) return this.metricsCache.get(key)!;
    const metrics = this.analyzer.analyze(file.path, file.content);
    if (this.metricsCache.size >= METRICS_CACHE_SIZE) this.metricsCache.delete(this.metricsCache.keys().next().value!);
    this.metricsCache.set(key, metrics);
    return metrics;
  }

  assessFiles(files: readonly SourceFile[]): CodeQualityAssessment {
    return this.policy.assess(this.metrics(files));
  }

  /**
   * Every generated source file currently in the project workspace. Cached per project (the
   * Task 28 load test showed the file reads queueing behind running workflows); the DEV agent
   * invalidates it through writeReport whenever it changes the code.
   */
  assessProject(projectId: string, now = Date.now()): Promise<CodeQualityAssessment> {
    const cached = this.projectCache.get(projectId);
    if (cached && now - cached.at < PROJECT_CACHE_TTL_MS) return cached.assessment;
    const assessment = this.readAndAssess(projectId);
    this.projectCache.set(projectId, { at: now, assessment });
    assessment.catch(() => this.projectCache.delete(projectId));
    return assessment;
  }

  invalidate(projectId: string): void {
    this.projectCache.delete(projectId);
  }

  private async readAndAssess(projectId: string): Promise<CodeQualityAssessment> {
    const paths = (await this.workspace.listFiles(projectId).catch(() => [] as string[])).filter(CodeQualityService.isSource).slice(0, MAX_FILES);
    const contents = await Promise.all(paths.map(path => this.workspace.readFile(projectId, path)));
    const files: SourceFile[] = paths.flatMap((path, i) => (contents[i] !== null ? [{ path, content: contents[i]! }] : []));
    return this.assessFiles(files);
  }

  /** Markdown report written next to the other OOAD documents */
  async writeReport(projectId: string, assessment: CodeQualityAssessment, note = ''): Promise<string | null> {
    this.invalidate(projectId);
    try {
      return await this.workspace.writeFile(projectId, CODE_QUALITY_REPORT_PATH, CodeQualityService.markdown(assessment, note));
    } catch (err: any) {
      this.logger.warn(`Could not write the code quality report: ${err.message}`);
      return null;
    }
  }

  static markdown(a: CodeQualityAssessment, note = ''): string {
    const rows = a.files.map(f => `| \`${f.path}\` | ${f.score} | ${f.loc} | ${f.maxComplexity} | ${f.maintainabilityIndex} | ${f.findings.length} |`);
    const findings = a.files.flatMap(f => f.findings.map(x => `- \`${f.path}:${x.line}\` **${x.kind}** (${x.rule}): ${x.message}`));
    return [
      '# Code Quality Report',
      '',
      note,
      `**Score:** ${a.score ?? 'n/a'} / 100 (threshold ${a.threshold})  `,
      `**Predicted QA verdict:** ${a.predictedQaVerdict?.toUpperCase() ?? 'n/a'}${a.reasons.length ? ` (${a.reasons.join('; ')})` : ''}`,
      '',
      '| File | Score | LOC | Max complexity | Maintainability | Findings |',
      '|------|-------|-----|----------------|-----------------|----------|',
      ...rows,
      '',
      '## Findings',
      '',
      ...(findings.length ? findings : ['None.']),
      '',
    ].join('\n');
  }
}
