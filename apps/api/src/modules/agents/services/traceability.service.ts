import { Injectable } from '@nestjs/common';

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
  coverage: 'Covered' | 'Missing';
}

export interface TraceabilityReport {
  rows: TraceabilityRow[];
  coveredCount: number;
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

  build(useCases: TraceUseCase[], entities: string[], files: SourceFile[]): TraceabilityReport {
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
      return {
        useCaseId: uc.id,
        useCaseName: uc.name,
        priority: uc.priority || 'N/A',
        domainClasses,
        implementationFiles,
        testCases: Array.from(new Set(testCases)),
        coverage: testCases.length > 0 ? 'Covered' : 'Missing',
      };
    });

    const coveredCount = rows.filter(r => r.coverage === 'Covered').length;
    const totalCount = rows.length;
    const coveragePercent = totalCount > 0 ? Math.round((coveredCount / totalCount) * 1000) / 10 : 0;
    const missingUseCases = rows.filter(r => r.coverage === 'Missing').map(r => r.useCaseId);

    return {
      rows,
      coveredCount,
      totalCount,
      coveragePercent,
      missingUseCases,
      markdown: this.toMarkdown(rows, coveredCount, totalCount, coveragePercent, missingUseCases),
    };
  }

  private toMarkdown(
    rows: TraceabilityRow[],
    coveredCount: number,
    totalCount: number,
    coveragePercent: number,
    missingUseCases: string[]
  ): string {
    const cell = (items: string[]) => (items.length ? items.join(', ') : '-');
    let md = '# Traceability Matrix\n\n';
    md += '| Use Case ID | Use Case Name | Priority | Domain Classes | Implementation | Test Cases | Coverage |\n';
    md += '|-------------|---------------|----------|----------------|----------------|------------|----------|\n';
    for (const r of rows) {
      md += `| ${r.useCaseId} | ${r.useCaseName} | ${r.priority} | ${cell(r.domainClasses)} | ${cell(r.implementationFiles)} | ${cell(r.testCases)} | ${r.coverage} |\n`;
    }
    md += '\n**Summary:**\n';
    md += `- Total Use Cases: ${totalCount}\n`;
    md += `- Covered: ${coveredCount}\n`;
    md += `- Missing: ${totalCount - coveredCount}\n`;
    md += `- Coverage: ${coveragePercent}%\n`;
    if (coveragePercent < TraceabilityService.COVERAGE_THRESHOLD) {
      md += `\n**WARNING: Use case test coverage below ${TraceabilityService.COVERAGE_THRESHOLD}%**\n`;
      md += `Missing tests for: ${missingUseCases.join(', ')}\n`;
    }
    return md;
  }
}
