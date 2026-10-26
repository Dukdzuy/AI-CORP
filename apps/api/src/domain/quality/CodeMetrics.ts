/**
 * Static code metrics of one generated source file (Phase 6, Task 26).
 */
export type FindingKind = 'syntax' | 'complexity' | 'maintainability' | 'security' | 'layering' | 'traceability';

export interface CodeFinding {
  kind: FindingKind;
  rule: string;
  line: number;
  message: string;
}

export interface FunctionMetrics {
  name: string;
  line: number;
  /** McCabe cyclomatic complexity: 1 + decision points */
  complexity: number;
}

export interface FileMetrics {
  path: string;
  language: 'typescript' | 'javascript';
  /** Non-blank lines */
  loc: number;
  commentLines: number;
  functions: FunctionMetrics[];
  maxComplexity: number;
  /** Halstead volume N · log2(n) over the file's tokens */
  halsteadVolume: number;
  /** 0..100, normalised Maintainability Index (Visual Studio variant) */
  maintainabilityIndex: number;
  /** Use case references (// UC-xxx) in the file */
  useCaseRefs: string[];
  findings: CodeFinding[];
}

/** Port: turns source text into metrics; null for a file the analyzer does not support */
export interface ICodeAnalyzer {
  analyze(path: string, content: string): FileMetrics | null;
}

export const CODE_ANALYZER = Symbol('CODE_ANALYZER');

/**
 * Normalised Maintainability Index:
 * MI = max(0, (171 − 5.2·ln V − 0.23·CC − 16.2·ln LOC) · 100 / 171)
 * with V the Halstead volume, CC the cyclomatic complexity and LOC the lines of code.
 */
export function maintainabilityIndex(volume: number, complexity: number, loc: number): number {
  const raw = 171 - 5.2 * Math.log(Math.max(1, volume)) - 0.23 * complexity - 16.2 * Math.log(Math.max(1, loc));
  return Math.round(Math.max(0, Math.min(100, (raw * 100) / 171)) * 10) / 10;
}
