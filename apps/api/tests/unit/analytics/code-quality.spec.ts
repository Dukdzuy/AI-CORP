import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TypeScriptCodeAnalyzer } from '../../../src/infrastructure/code-analysis/TypeScriptCodeAnalyzer';
import { CodeQualityPolicy, FileMetrics, layerOf, layerViolation, maintainabilityIndex, resolveImport } from '../../../src/domain/quality';
import { CodeQualityService } from '../../../src/modules/code-quality/code-quality.service';
import { ProjectWorkspace } from '../../../src/modules/workspace/project-workspace.service';

const analyzer = new TypeScriptCodeAnalyzer();
const analyze = (p: string, src: string) => analyzer.analyze(p, src)!;

const CLEAN = `// UC-001: Place order
import { Order } from '../../domain/entities/Order';

export class OrderService {
  constructor(private readonly orders: Map<string, Order>) {}

  // UC-001
  place(id: string, order: Order): Order {
    if (this.orders.has(id)) {
      throw new Error('duplicate');
    }
    this.orders.set(id, order);
    return order;
  }
}
`;

const complexBody = Array.from({ length: 12 }, (_, i) => `  if (x === ${i} && y) { r += ${i}; }`).join('\n');
const MESSY = `import { PrismaOrderRepository } from '../../infrastructure/PrismaOrderRepository';
const apiKey = 'sk-live-1234567890';
export function messy(x: number, y: boolean): number {
  let r = 0;
${complexBody}
  eval('r++');
  document.body.innerHTML = String(r);
  return r;
}
`;

describe('Phase 6 / Task 26: TypeScript code analyzer', () => {
  it('measures functions, complexity, comments, Halstead volume and use case references', () => {
    const m = analyze('src/application/services/OrderService.ts', CLEAN);
    expect(m.language).toBe('typescript');
    expect(m.functions.map(f => [f.name, f.complexity])).toEqual([['constructor', 1], ['place', 2]]);
    expect(m.maxComplexity).toBe(2);
    expect(m.commentLines).toBe(2);
    expect(m.loc).toBe(13);
    expect(m.halsteadVolume).toBeGreaterThan(100);
    expect(m.maintainabilityIndex).toBeGreaterThan(40);
    expect(m.useCaseRefs).toEqual(['UC-001']);
    expect(m.findings).toEqual([]);
  });

  it('counts decision points: branches, loops, cases, catch, ternaries and short-circuit operators, not nested functions', () => {
    const src = `function f(a: any) {
  for (const x of a) { if (x) continue; }
  while (a.length) a.pop();
  switch (a.k) { case 1: break; case 2: break; default: break; }
  try { a(); } catch { /* */ }
  const v = a ? 1 : 2;
  const w = a.b ?? a.c || a.d && a.e;
  const inner = () => { if (a) return 1; return 2; };
  return v + w + inner();
}`;
    const m = analyze('src/f.ts', src);
    expect(m.functions.find(f => f.name === 'f')!.complexity).toBe(1 + 1 + 1 + 1 + 2 + 1 + 1 + 3);
    expect(m.functions.find(f => f.name === 'inner')!.complexity).toBe(2);
  });

  it('reports syntax errors, security patterns and layer violations', () => {
    const m = analyze('src/domain/services/Messy.ts', MESSY);
    const rules = m.findings.map(f => f.rule);
    expect(rules).toEqual(expect.arrayContaining(['dependency-direction', 'no-hardcoded-secret', 'no-eval', 'no-inner-html']));
    expect(m.findings.find(f => f.kind === 'layering')!.message).toBe("domain layer imports infrastructure ('../../infrastructure/PrismaOrderRepository')");
    expect(m.functions[0].complexity).toBeGreaterThan(20);

    const broken = analyze('src/app.js', 'function (\n');
    expect(broken.language).toBe('javascript');
    expect(broken.findings.some(f => f.kind === 'syntax' && f.rule.startsWith('TS'))).toBe(true);

    const shell = analyze('src/infrastructure/run.ts', "import { exec } from 'child_process';\nexec('ls');\nexec(`rm ${process.argv[2]}`);\nconst f = new Function('return 1');\ndocument.write('x');\nconst x = require('../presentation/ui');");
    expect(shell.findings.map(f => f.rule)).toEqual(['no-shell-injection', 'no-new-function', 'no-document-write', 'dependency-direction']);
  });

  it('ignores files it cannot parse as TypeScript or JavaScript', () => {
    expect(analyzer.analyze('docs/readme.md', '# hi')).toBeNull();
    expect(analyze('src/ui/App.tsx', 'export const App = () => <div>{1 > 0 ? "a" : "b"}</div>;').findings).toEqual([]);
  });
});

describe('Phase 6 / Task 26: layering rules and quality policy', () => {
  it('layers and import directions', () => {
    expect(layerOf('src/domain/entities/Order.ts')).toBe('domain');
    expect(layerOf('src/composition-root.ts')).toBeNull();
    expect(resolveImport('src/application/services/A.ts', '../../domain/entities/Order')).toBe('src/domain/entities/Order');
    expect(resolveImport('src/a.ts', 'express')).toBeNull();
    expect(layerViolation('src/application/services/A.ts', '../../domain/entities/Order')).toBeNull();
    expect(layerViolation('src/application/services/A.ts', '../../presentation/controllers/C')).toEqual({ from: 'application', to: 'presentation' });
    expect(layerViolation('src/presentation/controllers/C.ts', '../../infrastructure/db')).toEqual({ from: 'presentation', to: 'infrastructure' });
    expect(layerViolation('src/infrastructure/db.ts', '../domain/x')).toBeNull();
    expect(layerViolation('src/composition-root.ts', './infrastructure/db')).toBeNull();
  });

  it('maintainability index is normalised to 0..100', () => {
    expect(maintainabilityIndex(1, 1, 1)).toBe(99.9);
    expect(maintainabilityIndex(1e9, 500, 1e6)).toBe(0);
  });

  it('scores files with capped penalties and predicts the QA verdict', () => {
    const policy = new CodeQualityPolicy(70);
    const clean = analyze('src/application/services/OrderService.ts', CLEAN);
    const messy = analyze('src/domain/services/Messy.ts', MESSY);

    expect(policy.scoreFile(clean).score).toBe(100);
    const scored = policy.scoreFile(messy);
    // complexity (capped 30) + layering 10 + security 3 × 10 (capped 30)
    expect(scored.score).toBe(100 - 30 - 10 - 30);
    expect(scored.findings.some(f => f.kind === 'complexity')).toBe(true);

    const good = policy.assess([clean]);
    expect(good).toMatchObject({ score: 100, predictedQaVerdict: 'pass', reasons: [], threshold: 70 });

    const bad = policy.assess([clean, messy]);
    expect(bad.files[0].path).toBe('src/domain/services/Messy.ts'); // worst first
    expect(bad.score).toBe(Math.round((100 * clean.loc + 30 * messy.loc) / (clean.loc + messy.loc)));
    expect(bad.predictedQaVerdict).toBe('fail');
    expect(bad.reasons).toEqual(expect.arrayContaining(['1 layer violation(s)']));
    expect(bad.totals).toMatchObject({ layering: 1, security: 3, complexity: 1 });

    expect(policy.assess([])).toMatchObject({ score: null, predictedQaVerdict: null });
    expect(CodeQualityPolicy.summarize(policy.assess([]))).toBe('No analysable source files.');
    const summary = CodeQualityPolicy.summarize(bad, 2);
    expect(summary).toContain('predicted QA verdict: FAIL');
    expect(summary).toMatch(/… \d+ more/);
  });

  it('an application service without a use case reference, and a very unmaintainable file, lose points', () => {
    const policy = new CodeQualityPolicy();
    const m: FileMetrics = {
      path: 'src/application/services/PayService.ts', language: 'typescript', loc: 400, commentLines: 0,
      functions: [{ name: 'pay', line: 1, complexity: 3 }], maxComplexity: 3, halsteadVolume: 90_000, maintainabilityIndex: 8,
      useCaseRefs: [], findings: [{ kind: 'syntax', rule: 'TS1005', line: 3, message: "';' expected" }],
    };
    const scored = policy.scoreFile(m);
    expect(scored.findings.map(f => f.kind).sort()).toEqual(['maintainability', 'syntax', 'traceability']);
    expect(scored.score).toBe(100 - 15 - 20 - 5);
    expect(policy.assess([m]).reasons).toEqual(['quality score 60 is below 70', '1 syntax error(s)']);
  });
});

describe('Phase 6 / Task 26: CodeQualityService', () => {
  let root: string;
  let workspace: ProjectWorkspace;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-'));
    process.env.PROJECTS_WORKSPACE_DIR = root;
    workspace = new ProjectWorkspace();
  });
  afterEach(() => {
    delete process.env.PROJECTS_WORKSPACE_DIR;
    delete process.env.CODE_QUALITY_MIN_SCORE;
    delete process.env.CODE_QUALITY_REFINE;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('analyses the generated sources of a workspace (not tests or docs) and writes a Markdown report', async () => {
    await workspace.writeFile('p1', 'src/application/services/OrderService.ts', CLEAN);
    await workspace.writeFile('p1', 'src/domain/services/Messy.ts', MESSY);
    await workspace.writeFile('p1', 'tests/UC-001.spec.ts', 'eval("x")');
    await workspace.writeFile('p1', 'src/domain/Order.spec.ts', 'eval("x")');
    await workspace.writeFile('p1', 'docs/use-cases.md', '# UC');
    const service = new CodeQualityService(analyzer, workspace);

    const assessment = await service.assessProject('p1');
    expect(assessment.files.map(f => f.path).sort()).toEqual(['src/application/services/OrderService.ts', 'src/domain/services/Messy.ts']);
    expect(assessment.predictedQaVerdict).toBe('fail');

    const written = await service.writeReport('p1', assessment, 'Score before refinement: 40.\n');
    expect(written).toContain('docs/code-quality.md');
    const report = (await workspace.readFile('p1', 'docs/code-quality.md'))!;
    expect(report).toContain('# Code Quality Report');
    expect(report).toContain('Score before refinement: 40.');
    expect(report).toContain('| `src/domain/services/Messy.ts` | 30 |');
    expect(report).toContain('**layering** (dependency-direction)');

    expect((await service.assessProject('empty')).score).toBeNull();
  });

  it('threshold and refinement switch come from the environment', () => {
    process.env.CODE_QUALITY_MIN_SCORE = '85';
    process.env.CODE_QUALITY_REFINE = 'off';
    const service = new CodeQualityService(analyzer, workspace);
    expect(service.policy.threshold).toBe(85);
    expect(service.refinementEnabled).toBe(false);
    expect(CodeQualityService.isSource('src/a.ts')).toBe(true);
    expect(CodeQualityService.isSource('src/__tests__/a.ts')).toBe(false);
    expect(CodeQualityService.isSource('lib/a.ts')).toBe(false);
  });
});
