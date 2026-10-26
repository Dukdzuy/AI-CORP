import * as path from 'path';
import { TraceUseCase } from './traceability.service';

/** The parts of Jest's `--json` report that QC reads */
export interface JestAssertionResult {
  ancestorTitles?: string[];
  title: string;
  fullName?: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped' | 'todo' | 'disabled' | string;
  failureMessages?: string[];
}

export interface JestTestFileResult {
  /** Absolute path of the test file inside the run directory */
  name: string;
  status: 'passed' | 'failed' | string;
  message?: string;
  assertionResults?: JestAssertionResult[];
}

export interface JestJsonReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  success?: boolean;
  testResults?: JestTestFileResult[];
}

/** Executed test results of one use case */
export interface UseCaseExecution {
  useCaseId: string;
  passed: number;
  failed: number;
  /** "<test name>: <first failure line>" */
  failingTests: string[];
}

/** Outcome of running the generated project's test suite */
export interface TestExecutionSummary {
  /** False when the tests could not be run (no Docker, no jest config, unreadable report) */
  executed: boolean;
  passed: number;
  failed: number;
  total: number;
  byUseCase: Record<string, UseCaseExecution>;
  /** Failing tests that mention no known use case */
  unmappedFailures: string[];
  /** Why the tests were not executed, when executed is false */
  reason?: string;
  exitCode?: number;
  mode?: 'docker' | 'local';
}

const UC_ID = /UC-\d{3}/g;

/**
 * JestReportMapper
 *
 * Maps Jest's JSON report onto use cases. A test belongs to the use cases named in its
 * describe/it titles (`describe('UC-001: Place Order', ...)`); a test whose titles name
 * none inherits the ids in its file name (`tests/UC-001.spec.ts`) or matches by use case
 * name. A file that fails before any test runs (syntax or import error) counts as one
 * failure for every use case its file name refers to.
 * Pure logic, so the rules are unit tested without running Jest.
 */
export class JestReportMapper {
  static notExecuted(reason: string, extra: Partial<TestExecutionSummary> = {}): TestExecutionSummary {
    return { executed: false, passed: 0, failed: 0, total: 0, byUseCase: {}, unmappedFailures: [], reason, ...extra };
  }

  map(report: JestJsonReport, useCases: TraceUseCase[]): TestExecutionSummary {
    const byUseCase: Record<string, UseCaseExecution> = {};
    const unmappedFailures: string[] = [];
    let passed = 0;
    let failed = 0;

    const entry = (id: string): UseCaseExecution =>
      (byUseCase[id] ||= { useCaseId: id, passed: 0, failed: 0, failingTests: [] });

    for (const file of report.testResults || []) {
      const fileIds = this.idsIn(path.basename(file.name), useCases);
      const assertions = (file.assertionResults || []).filter(a => a.status === 'passed' || a.status === 'failed');

      if (assertions.length === 0 && file.status === 'failed') {
        const testName = `${path.basename(file.name)}: ${this.firstLine(file.message) || 'test file failed to run'}`;
        failed += 1;
        if (fileIds.length === 0) unmappedFailures.push(testName);
        for (const id of fileIds) {
          entry(id).failed += 1;
          entry(id).failingTests.push(testName);
        }
        continue;
      }

      for (const assertion of assertions) {
        const testName = assertion.fullName || [...(assertion.ancestorTitles || []), assertion.title].join(' ');
        const titleIds = this.idsIn(testName, useCases);
        const ids = titleIds.length > 0 ? titleIds : fileIds;
        const isPass = assertion.status === 'passed';
        if (isPass) passed += 1;
        else failed += 1;

        const failure = `${testName}: ${this.firstLine(assertion.failureMessages?.[0]) || 'failed'}`;
        if (ids.length === 0 && !isPass) unmappedFailures.push(failure);
        for (const id of ids) {
          const e = entry(id);
          if (isPass) {
            e.passed += 1;
          } else {
            e.failed += 1;
            e.failingTests.push(failure);
          }
        }
      }
    }

    return { executed: true, passed, failed, total: passed + failed, byUseCase, unmappedFailures };
  }

  /** Use case ids in a text: explicit UC-xxx ids, else use case names (case-insensitive) */
  private idsIn(text: string, useCases: TraceUseCase[]): string[] {
    const known = new Set(useCases.map(uc => uc.id));
    const explicit = Array.from(new Set(text.match(UC_ID) || [])).filter(id => known.size === 0 || known.has(id));
    if (explicit.length > 0) return explicit;
    const lower = text.toLowerCase();
    return useCases.filter(uc => uc.name && lower.includes(uc.name.toLowerCase())).map(uc => uc.id);
  }

  private firstLine(message?: string): string {
    if (!message) return '';
    // Strip ANSI colours and keep the first meaningful line
    const clean = message.replace(/\u001b\[[0-9;]*m/g, '');
    const line = clean.split('\n').map(l => l.trim()).find(l => l.length > 0 && !l.startsWith('●')) || '';
    return line.slice(0, 200);
  }
}
