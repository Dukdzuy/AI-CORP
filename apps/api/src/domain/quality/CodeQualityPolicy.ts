/**
 * Scores generated code and predicts the QA verdict before QA reviews it (Phase 6, Task 26)
 *
 * Score (0..100) per file = 100 minus capped penalties:
 * | Finding                                   | Penalty      | Cap |
 * |-------------------------------------------|--------------|-----|
 * | syntax error                              | 15 each      | 45  |
 * | function with complexity > 10             | 3 per point above 10 | 30 |
 * | maintainability index < 20 (< 10)         | 10 (20)      | 20  |
 * | security pattern                          | 10 each      | 30  |
 * | layer violation (domain → infrastructure…)| 10 each      | 30  |
 * | application service without // UC-xxx     | 5            | 5   |
 * The project score is the line-weighted average of its files.
 *
 * The QA prediction is a rule, not a trained model: QA rejects code that does not follow
 * the design, so syntax errors, layer violations or a score under the threshold predict
 * a FAIL. Its agreement with the real QA verdicts is measured by the analytics (Task 24).
 *
 * @pattern Policy / Specification
 */
import { CodeFinding, FileMetrics, FindingKind } from './CodeMetrics';

export interface FileAssessment {
  path: string;
  score: number;
  loc: number;
  maxComplexity: number;
  maintainabilityIndex: number;
  findings: CodeFinding[];
}

export interface CodeQualityAssessment {
  score: number | null; // null when no file could be analysed
  files: FileAssessment[];
  totals: Record<FindingKind, number>;
  predictedQaVerdict: 'pass' | 'fail' | null;
  reasons: string[];
  threshold: number;
}

const PENALTIES: Record<FindingKind, { each: number; cap: number }> = {
  syntax: { each: 15, cap: 45 },
  complexity: { each: 0, cap: 30 }, // computed from the complexity itself
  maintainability: { each: 0, cap: 20 },
  security: { each: 10, cap: 30 },
  layering: { each: 10, cap: 30 },
  traceability: { each: 5, cap: 5 },
};

export const COMPLEXITY_LIMIT = 10;
/** Visual Studio's bands: below 20 is hard to maintain, below 10 very hard */
export const MAINTAINABILITY_LIMIT = 20;
export const DEFAULT_QUALITY_THRESHOLD = 70;

export class CodeQualityPolicy {
  constructor(readonly threshold = DEFAULT_QUALITY_THRESHOLD) {}

  /** Adds the complexity, maintainability and traceability findings the analyzer does not produce */
  findingsOf(m: FileMetrics): CodeFinding[] {
    const findings = [...m.findings];
    for (const fn of m.functions) {
      if (fn.complexity > COMPLEXITY_LIMIT) {
        findings.push({ kind: 'complexity', rule: 'cyclomatic-complexity', line: fn.line, message: `${fn.name} has complexity ${fn.complexity} (limit ${COMPLEXITY_LIMIT})` });
      }
    }
    if (m.loc >= 10 && m.maintainabilityIndex < MAINTAINABILITY_LIMIT) {
      findings.push({ kind: 'maintainability', rule: 'maintainability-index', line: 1, message: `maintainability index ${m.maintainabilityIndex} (below ${MAINTAINABILITY_LIMIT})` });
    }
    if (/(^|\/)application\/.*service/i.test(m.path) && !m.useCaseRefs.length && !/\.(spec|test)\./.test(m.path)) {
      findings.push({ kind: 'traceability', rule: 'use-case-reference', line: 1, message: 'application service without a // UC-xxx reference' });
    }
    return findings;
  }

  scoreFile(m: FileMetrics): FileAssessment {
    const findings = this.findingsOf(m);
    const penalty = (kind: FindingKind, amount: number) => Math.min(PENALTIES[kind].cap, amount);
    const count = (kind: FindingKind) => findings.filter(f => f.kind === kind).length;
    const excess = m.functions.reduce((s, fn) => s + Math.max(0, fn.complexity - COMPLEXITY_LIMIT), 0);
    const mi = m.loc >= 10 ? (m.maintainabilityIndex < MAINTAINABILITY_LIMIT / 2 ? 20 : m.maintainabilityIndex < MAINTAINABILITY_LIMIT ? 10 : 0) : 0;
    const total =
      penalty('syntax', count('syntax') * PENALTIES.syntax.each) +
      penalty('complexity', excess * 3) +
      penalty('maintainability', mi) +
      penalty('security', count('security') * PENALTIES.security.each) +
      penalty('layering', count('layering') * PENALTIES.layering.each) +
      penalty('traceability', count('traceability') * PENALTIES.traceability.each);
    return {
      path: m.path,
      score: Math.max(0, 100 - total),
      loc: m.loc,
      maxComplexity: m.maxComplexity,
      maintainabilityIndex: m.maintainabilityIndex,
      findings,
    };
  }

  assess(metrics: readonly FileMetrics[]): CodeQualityAssessment {
    const files = metrics.map(m => this.scoreFile(m)).sort((a, b) => a.score - b.score || a.path.localeCompare(b.path));
    const totals: Record<FindingKind, number> = { syntax: 0, complexity: 0, maintainability: 0, security: 0, layering: 0, traceability: 0 };
    for (const f of files) for (const x of f.findings) totals[x.kind]++;
    const lines = files.reduce((s, f) => s + Math.max(1, f.loc), 0);
    const score = files.length ? Math.round(files.reduce((s, f) => s + f.score * Math.max(1, f.loc), 0) / lines) : null;

    const reasons: string[] = [];
    if (score !== null && score < this.threshold) reasons.push(`quality score ${score} is below ${this.threshold}`);
    if (totals.syntax) reasons.push(`${totals.syntax} syntax error(s)`);
    if (totals.layering) reasons.push(`${totals.layering} layer violation(s)`);
    return {
      score,
      files,
      totals,
      predictedQaVerdict: score === null ? null : reasons.length ? 'fail' : 'pass',
      reasons,
      threshold: this.threshold,
    };
  }

  /** Short text for the QA prompt and the DEV refinement prompt */
  static summarize(a: CodeQualityAssessment, maxFindings = 15): string {
    if (a.score === null) return 'No analysable source files.';
    const lines = [`Static analysis score: ${a.score}/100 (threshold ${a.threshold}); predicted QA verdict: ${a.predictedQaVerdict?.toUpperCase()}`];
    const findings = a.files.flatMap(f => f.findings.map(x => `- ${f.path}:${x.line} [${x.kind}] ${x.message}`));
    lines.push(...findings.slice(0, maxFindings));
    if (findings.length > maxFindings) lines.push(`- … ${findings.length - maxFindings} more`);
    return lines.join('\n');
  }
}
