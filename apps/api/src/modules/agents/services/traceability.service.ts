import { Injectable } from '@nestjs/common';
import type { TestExecutionSummary } from './jest-report.mapper';

export interface TraceUseCase {
  id: string;
  name: string;
  priority?: string;
}

export interface SourceFile {
  /** Path relative to the generated project's root */
  path: string;
  content: string;
}

export interface TraceabilityRow {
  useCaseId: string;
  useCaseName: string;
  priority: string;
  domainClasses: string[];
  implementationFiles: string[];
  testCases: string[];
  /**
   * Covered = tests exist but were not executed; once QC has run them (Task 12):
   * Passing = all executed tests pass, Failing = at least one fails or none ran.
   */
  coverage: 'Covered' | 'Passing' | 'Failing' | 'Missing';
  passedTests?: number;
  failedTests?: number;
  failingTests?: string[];
}

export interface TraceabilityReport {
  rows: TraceabilityRow[];
  /** True when the coverage is based on executed tests */
  executed: boolean;
  /** Use cases counted as covered: with tests (static) or with passing tests (executed) */
  coveredCount: number;
  failingCount: number;
  failingUseCases: string[];
  /** Failing test descriptions, prefixed with their use case id */
  failingTests: string[];
  totalCount: number;
  coveragePercent: number;
  missingUseCases: string[];
  markdown: string;
}

const UC_ID = /UC-\d{3}/g;

/**
 * TraceabilityService
 *
 * Builds the requirements traceability matrix of a generated project:
 * use case → domain classes → implementation files → test cases.
 * Pure logic (no I/O) so the QC strategy and the metrics can share and test it.
 */
@Injectable()
export class TraceabilityService {
  static readonly COVERAGE_THRESHOLD = 80;

  /**
   * qc_passed rule: coverage >= 80% and no failing High-priority use case.
   * Without executed tests, coverage counts use cases that have tests at all.
   */
  static qcPassed(report: TraceabilityReport): boolean {
    if (report.totalCount === 0 || report.coveragePercent < TraceabilityService.COVERAGE_THRESHOLD) return false;
    return !report.rows.some(r => r.coverage === 'Failing' && r.priority.toLowerCase() === 'high');
  }

  isTestFile(filePath: string): boolean {
    return /\.(spec|test)\.[jt]sx?$/.test(filePath);
  }

  /** Test names (describe/it titles) that mention a use case id or name */
  parseTests(file: SourceFile): Array<{ ucIds: string[]; testName: string }> {
    const tests: Array<{ ucIds: string[]; testName: string }> = [];
    const pattern = /\b(describe|it|test)\s*\(\s*(['"`])(.+?)\2/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(file.content)) !== null) {
      const testName = match[3];
      tests.push({ ucIds: testName.match(UC_ID) || ([] as string[]), testName });
    }
    return tests;
  }

  /** Parse use cases from the rendered use-cases.md (fallback when ooadMetadata is missing) */
  parseUseCasesMarkdown(content: string): TraceUseCase[] {
    const useCases: TraceUseCase[] = [];
    const pattern = /##\s+Use Case:\s+(.+?)\n[\s\S]*?\|\s*\*\*ID\*\*\s*\|\s*(.+?)\s*\|(?:[\s\S]*?\|\s*\*\*Priority\*\*\s*\|\s*(.+?)\s*\|)?/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      useCases.push({ name: match[1].trim(), id: match[2].trim(), priority: match[3]?.trim() });
    }
    return useCases;
  }

  build(
    useCases: TraceUseCase[],
    entities: string[],
    files: SourceFile[],
    execution?: TestExecutionSummary
  ): TraceabilityReport {
    const executed = execution?.executed === true;
    const tests = files.filter(f => this.isTestFile(f.path));
    const sources = files.filter(f => !this.isTestFile(f.path) && /\.[jt]sx?$/.test(f.path));
    const parsedTests = tests.flatMap(file => this.parseTests(file).map(t => ({ ...t, file: file.path })));

    const rows: TraceabilityRow[] = useCases.map(uc => {
      const implementationFiles = sources
        .filter(f => (f.content.match(UC_ID) || ([] as string[])).includes(uc.id))
        .map(f => f.path);
      const testCases = parsedTests
        .filter(t => t.ucIds.includes(uc.id) || t.testName.toLowerCase().includes(uc.name.toLowerCase()))
        .map(t => t.testName);
      const domainClasses = entities.filter(entity => {
        const name = entity.toLowerCase();
        return uc.name.toLowerCase().includes(name)
          || implementationFiles.some(f => f.toLowerCase().includes(name));
      });
      const row: TraceabilityRow = {
        useCaseId: uc.id,
        useCaseName: uc.name,
        priority: uc.priority || 'N/A',
        domainClasses,
        implementationFiles,
        testCases: Array.from(new Set(testCases)),
        coverage: testCases.length > 0 ? 'Covered' : 'Missing',
      };
      if (executed) {
        const run = execution!.byUseCase[uc.id];
        row.passedTests = run?.passed || 0;
        row.failedTests = run?.failed || 0;
        row.failingTests = run?.failingTests || [];
        if (row.failedTests > 0) row.coverage = 'Failing';
        else if (row.passedTests > 0) row.coverage = 'Passing';
        // Tests exist in the files but none of them ran (e.g. skipped or not matched by Jest)
        else if (row.testCases.length > 0) row.coverage = 'Failing';
      }
      return row;
    });

    const coveredCount = rows.filter(r => r.coverage === (executed ? 'Passing' : 'Covered')).length;
    const totalCount = rows.length;
    const coveragePercent = totalCount > 0 ? Math.round((coveredCount / totalCount) * 1000) / 10 : 0;
    const missingUseCases = rows.filter(r => r.coverage === 'Missing').map(r => r.useCaseId);
    const failingRows = rows.filter(r => r.coverage === 'Failing');
    const failingTests = failingRows.flatMap(r =>
      r.failingTests?.length ? r.failingTests.map(t => `${r.useCaseId}: ${t}`) : [`${r.useCaseId}: tests did not run`]
    );

    const report: TraceabilityReport = {
      rows,
      executed,
      coveredCount,
      failingCount: failingRows.length,
      failingUseCases: failingRows.map(r => r.useCaseId),
      failingTests,
      totalCount,
      coveragePercent,
      missingUseCases,
      markdown: '',
    };
    report.markdown = this.toMarkdown(report, execution);
    return report;
  }

  private toMarkdown(report: TraceabilityReport, execution?: TestExecutionSummary): string {
    const { rows, executed, coveredCount, totalCount, coveragePercent, missingUseCases } = report;
    const cell = (items: string[]) => (items.length ? items.join(', ') : '-');
    let md = '# Traceability Matrix\n\n';
    if (executed) {
      md += '| Use Case ID | Use Case Name | Priority | Domain Classes | Implementation | Test Cases | Passed / Failed | Status |\n';
      md += '|-------------|---------------|----------|----------------|----------------|------------|-----------------|--------|\n';
    } else {
      md += '| Use Case ID | Use Case Name | Priority | Domain Classes | Implementation | Test Cases | Coverage |\n';
      md += '|-------------|---------------|----------|----------------|----------------|------------|----------|\n';
    }
    for (const r of rows) {
      const base = `| ${r.useCaseId} | ${r.useCaseName} | ${r.priority} | ${cell(r.domainClasses)} | ${cell(r.implementationFiles)} | ${cell(r.testCases)} |`;
      md += executed ? `${base} ${r.passedTests} / ${r.failedTests} | ${r.coverage} |\n` : `${base} ${r.coverage} |\n`;
    }
    md += '\n**Summary:**\n';
    md += `- Total Use Cases: ${totalCount}\n`;
    if (executed) {
      md += `- Passing: ${coveredCount}\n`;
      md += `- Failing: ${report.failingCount}\n`;
      md += `- Missing: ${missingUseCases.length}\n`;
      md += `- Coverage (passing use cases): ${coveragePercent}%\n`;
      md += `- Tests executed: ${execution!.total} (${execution!.passed} passed, ${execution!.failed} failed)\n`;
    } else {
      md += `- Covered: ${coveredCount}\n`;
      md += `- Missing: ${totalCount - coveredCount}\n`;
      md += `- Coverage: ${coveragePercent}%\n`;
      if (execution?.reason) md += `- Tests not executed: ${execution.reason}\n`;
    }
    if (coveragePercent < TraceabilityService.COVERAGE_THRESHOLD) {
      md += `\n**WARNING: Use case test coverage below ${TraceabilityService.COVERAGE_THRESHOLD}%**\n`;
      if (missingUseCases.length) md += `Missing tests for: ${missingUseCases.join(', ')}\n`;
    }
    if (report.failingTests.length) {
      md += '\n**Failing tests:**\n';
      for (const t of report.failingTests) md += `- ${t}\n`;
    }
    if (execution?.unmappedFailures?.length) {
      md += '\n**Failing tests not linked to a use case:**\n';
      for (const t of execution.unmappedFailures) md += `- ${t}\n`;
    }
    return md;
  }
}
