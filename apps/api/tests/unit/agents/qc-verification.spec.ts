import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SandboxExecutor } from '../../../src/modules/tools/sandbox.executor';
import { ProjectWorkspace } from '../../../src/modules/workspace/project-workspace.service';
import { JestJsonReport, JestReportMapper } from '../../../src/modules/agents/services/jest-report.mapper';
import { ProjectTestRunner } from '../../../src/modules/agents/services/project-test-runner.service';
import { TraceabilityService } from '../../../src/modules/agents/services/traceability.service';

const limits = { maxMemoryMB: 512, maxCPUPercent: 50, maxDiskMB: 256, timeout: 120000 };

const useCases = [
  { id: 'UC-001', name: 'Place Order', priority: 'High' },
  { id: 'UC-002', name: 'Cancel Order', priority: 'High' },
  { id: 'UC-003', name: 'Add Product', priority: 'Medium' },
  { id: 'UC-004', name: 'Pay Invoice', priority: 'High' },
  { id: 'UC-005', name: 'Browse Catalog', priority: 'Low' },
];

const testFiles = useCases.map(uc => ({
  path: `tests/${uc.id}.spec.ts`,
  content: `describe('${uc.id}: ${uc.name}', () => { it('main flow', () => {}); });`,
}));

/** Execution summary where the given use cases pass / fail one test each */
const execution = (passing: string[], failing: string[]) => {
  const byUseCase: Record<string, { useCaseId: string; passed: number; failed: number; failingTests: string[] }> = {};
  for (const id of passing) byUseCase[id] = { useCaseId: id, passed: 1, failed: 0, failingTests: [] };
  for (const id of failing) byUseCase[id] = { useCaseId: id, passed: 0, failed: 1, failingTests: [`${id} main flow: boom`] };
  return { executed: true, passed: passing.length, failed: failing.length, total: passing.length + failing.length, byUseCase, unmappedFailures: [] };
};

describe('SandboxExecutor.runInWorkspace', () => {
  const sandbox = new SandboxExecutor();
  let dir: string;

  beforeEach(() => {
    (sandbox as any).dockerAvailable = false;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-ws-'));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'original');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('mounts only the project folder, read-only, with no network', () => {
    const options = sandbox.workspaceContainerOptions(dir, 'npm test', limits, { registryUrl: '' });
    const host = options.HostConfig!;

    expect(host.Binds).toEqual([`${dir}:/workspace:ro`]);
    expect(host.ReadonlyRootfs).toBe(true);
    expect(host.NetworkMode).toBe('none');
    expect(host.CapDrop).toEqual(['ALL']);
    expect(host.SecurityOpt).toContain('no-new-privileges=true');
    expect(Object.keys(host.Tmpfs!)).toEqual(['/work', '/tmp']);
    expect(host.Tmpfs!['/work']).toContain('size=256m');
    expect(host.Memory).toBe(512 * 1024 * 1024);
    expect(options.User).toBe('node');
    // The command works on a tmpfs copy, never in /workspace
    expect(options.Cmd).toEqual(['/bin/sh', '-c', 'cp -R /workspace/. /work/ && cd /work && npm test']);
    expect(JSON.stringify(options)).not.toContain('docker.sock');
  });

  it('opens the network only for a configured package registry', () => {
    const options = sandbox.workspaceContainerOptions(dir, 'npm test', limits, { registryUrl: 'http://verdaccio:4873' });
    expect(options.HostConfig!.NetworkMode).toBe('bridge');
    expect(options.Env).toContain('npm_config_registry=http://verdaccio:4873');
  });

  it('refuses the local fallback unless it is allowed', async () => {
    const previous = process.env.SANDBOX_ALLOW_LOCAL_RUN;
    delete process.env.SANDBOX_ALLOW_LOCAL_RUN;
    try {
      await expect(sandbox.runInWorkspace(dir, 'echo hi', limits)).rejects.toThrow(/local fallback is disabled/);
    } finally {
      if (previous !== undefined) process.env.SANDBOX_ALLOW_LOCAL_RUN = previous;
    }
  });

  it('runs locally in a copy and leaves the project folder unchanged', async () => {
    const result = await sandbox.runInWorkspace(
      dir,
      'cat a.txt; echo changed > a.txt; touch new.txt; exit 3',
      limits,
      { allowLocal: true, localNodeModules: '/nonexistent' }
    );

    expect(result).toEqual(expect.objectContaining({ exitCode: 3, mode: 'local', timedOut: false }));
    expect(result.output).toContain('original');
    expect(fs.readFileSync(path.join(dir, 'a.txt'), 'utf-8')).toBe('original');
    expect(fs.existsSync(path.join(dir, 'new.txt'))).toBe(false);
  });

  it('rejects a missing folder', async () => {
    await expect(sandbox.runInWorkspace(path.join(dir, 'missing'), 'echo', limits, { allowLocal: true })).rejects.toThrow(/does not exist/);
  });

  it('demultiplexes Docker log frames', () => {
    const frame = (type: number, text: string) => {
      const payload = Buffer.from(text);
      const header = Buffer.alloc(8);
      header[0] = type;
      header.writeUInt32BE(payload.length, 4);
      return Buffer.concat([header, payload]);
    };
    const logs = Buffer.concat([frame(1, '{"a":'), frame(2, ''), frame(1, '1}')]);
    expect(SandboxExecutor.demuxLogs(logs)).toBe('{"a":1}');
    expect(SandboxExecutor.demuxLogs(Buffer.from('plain tty output'))).toBe('plain tty output');
  });
});

describe('JestReportMapper', () => {
  const mapper = new JestReportMapper();

  it('maps assertions to use cases by title, then by file name, then by use case name', () => {
    const report: JestJsonReport = {
      testResults: [
        {
          name: '/work/tests/UC-001.spec.ts',
          status: 'failed',
          assertionResults: [
            { ancestorTitles: ['UC-001: Place Order'], title: 'main flow', fullName: 'UC-001: Place Order main flow', status: 'passed' },
            {
              ancestorTitles: ['UC-001: Place Order'], title: 'rejects an empty cart', fullName: 'UC-001: Place Order rejects an empty cart',
              status: 'failed', failureMessages: ['\u001b[31mError: expect(received).toThrow()\u001b[39m\n    at Object.<anonymous>'],
            },
          ],
        },
        // No id in the titles: inherits UC-002 from the file name
        { name: '/work/tests/UC-002.spec.ts', status: 'passed', assertionResults: [{ title: 'cancels a paid order', status: 'passed' }] },
        // No id anywhere: matched by use case name
        { name: '/work/tests/products.spec.ts', status: 'passed', assertionResults: [{ title: 'add product stores it', status: 'passed' }] },
        { name: '/work/tests/misc.spec.ts', status: 'failed', assertionResults: [{ title: 'helper works', status: 'failed', failureMessages: ['nope'] }] },
        { name: '/work/tests/UC-005.spec.ts', status: 'passed', assertionResults: [{ title: 'later', status: 'todo' }] },
      ],
    };

    const summary = mapper.map(report, useCases);

    expect(summary).toEqual(expect.objectContaining({ executed: true, passed: 3, failed: 2, total: 5 }));
    expect(summary.byUseCase['UC-001']).toEqual({
      useCaseId: 'UC-001', passed: 1, failed: 1,
      failingTests: ['UC-001: Place Order rejects an empty cart: Error: expect(received).toThrow()'],
    });
    expect(summary.byUseCase['UC-002']).toEqual(expect.objectContaining({ passed: 1, failed: 0 }));
    expect(summary.byUseCase['UC-003']).toEqual(expect.objectContaining({ passed: 1, failed: 0 }));
    expect(summary.byUseCase['UC-005']).toBeUndefined();
    expect(summary.unmappedFailures).toEqual(['helper works: nope']);
  });

  it('counts a test file that fails to run as a failure of its use case', () => {
    const summary = mapper.map({
      testResults: [{
        name: '/work/tests/UC-004.spec.ts',
        status: 'failed',
        message: '  ● Test suite failed to run\n\n    Cannot find module \'../src/application/services/PaymentService\'',
        assertionResults: [],
      }],
    }, useCases);

    expect(summary.failed).toBe(1);
    expect(summary.byUseCase['UC-004'].failingTests).toEqual([
      "UC-004.spec.ts: Cannot find module '../src/application/services/PaymentService'",
    ]);
  });
});

describe('TraceabilityService with executed tests', () => {
  const service = new TraceabilityService();
  const files = [{ path: 'src/application/services/OrderService.ts', content: '// UC-001\n// UC-002' }, ...testFiles];

  it('reports Passing / Failing / Missing and counts only passing use cases', () => {
    const report = service.build(useCases, [], files.slice(0, 5), execution(['UC-001', 'UC-002', 'UC-004'], ['UC-003']));

    expect(report.executed).toBe(true);
    expect(report.rows.map(r => r.coverage)).toEqual(['Passing', 'Passing', 'Failing', 'Passing', 'Missing']);
    expect(report.coveredCount).toBe(3);
    expect(report.coveragePercent).toBe(60);
    expect(report.failingUseCases).toEqual(['UC-003']);
    expect(report.failingTests).toEqual(['UC-003: UC-003 main flow: boom']);
    expect(report.markdown).toContain('| Passed / Failed | Status |');
    expect(report.markdown).toContain('| 0 / 1 | Failing |');
    expect(report.markdown).toContain('- Tests executed: 4 (3 passed, 1 failed)');
    expect(report.markdown).toContain('**Failing tests:**\n- UC-003: UC-003 main flow: boom');
  });

  it('treats tests that exist but did not run as failing', () => {
    const report = service.build(useCases.slice(0, 1), [], files, execution([], []));
    expect(report.rows[0]).toEqual(expect.objectContaining({ coverage: 'Failing', passedTests: 0, failedTests: 0 }));
    expect(report.failingTests).toEqual(['UC-001: tests did not run']);
  });

  it('keeps the static Covered status when the tests were not executed', () => {
    const report = service.build(useCases, [], files, JestReportMapper.notExecuted('Docker is not available'));
    expect(report.executed).toBe(false);
    expect(report.rows.every(r => r.coverage === 'Covered')).toBe(true);
    expect(report.markdown).toContain('- Tests not executed: Docker is not available');
  });

  describe('qc_passed rule', () => {
    const ids = useCases.map(uc => uc.id);

    it('passes when every use case passes', () => {
      expect(TraceabilityService.qcPassed(service.build(useCases, [], files, execution(ids, [])))).toBe(true);
    });

    it('fails when a High-priority use case fails, even with coverage >= 80%', () => {
      const report = service.build(useCases, [], files, execution(ids.filter(id => id !== 'UC-001'), ['UC-001']));
      expect(report.coveragePercent).toBe(80);
      expect(TraceabilityService.qcPassed(report)).toBe(false);
    });

    it('tolerates a failing lower-priority use case at 80% coverage', () => {
      const report = service.build(useCases, [], files, execution(ids.filter(id => id !== 'UC-005'), ['UC-005']));
      expect(TraceabilityService.qcPassed(report)).toBe(true);
    });

    it('fails when tests are missing and coverage drops below 80%', () => {
      const report = service.build(useCases, [], files.slice(0, 4), execution(['UC-001', 'UC-002', 'UC-003'], []));
      expect(report.missingUseCases).toEqual(['UC-004', 'UC-005']);
      expect(TraceabilityService.qcPassed(report)).toBe(false);
      expect(TraceabilityService.qcPassed(service.build([], [], [], execution([], [])))).toBe(false);
    });
  });
});

describe('ProjectTestRunner', () => {
  const projectId = 'shop';
  let root: string;
  let workspace: ProjectWorkspace;
  let sandbox: SandboxExecutor;

  const jestConfig = fs.readFileSync(
    path.join(__dirname, '../../../src/modules/agents/templates/ooad/skeleton/jest.config.js.hbs'),
    'utf-8'
  );

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-ws-'));
    workspace = new ProjectWorkspace(root);
    sandbox = new SandboxExecutor();
    (sandbox as any).dockerAvailable = false;
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('extracts the report printed after the marker', () => {
    const report = { numTotalTests: 1, testResults: [] };
    expect(ProjectTestRunner.parseReport(`npm noise\n${ProjectTestRunner.REPORT_MARKER}\n${JSON.stringify(report)}\n`)).toEqual(report);
    expect(ProjectTestRunner.parseReport('no marker')).toBeNull();
    expect(ProjectTestRunner.parseReport(`${ProjectTestRunner.REPORT_MARKER}\nnot json`)).toBeNull();
  });

  it('does not run a project without a test setup', async () => {
    await workspace.writeFile(projectId, 'tests/UC-001.spec.ts', '');
    const summary = await new ProjectTestRunner(sandbox, workspace).run(projectId, useCases);
    expect(summary).toEqual(expect.objectContaining({ executed: false, reason: 'the project has no package.json / jest.config.js' }));
  });

  it('reports why the tests did not run when no sandbox is available', async () => {
    await workspace.writeFile(projectId, 'package.json', '{}');
    await workspace.writeFile(projectId, 'jest.config.js', jestConfig);
    const summary = await new ProjectTestRunner(sandbox, workspace).run(projectId, useCases, { allowLocal: false });
    expect(summary.executed).toBe(false);
    expect(summary.reason).toMatch(/local fallback is disabled/);
  });

  it('runs the generated Jest suite and maps a broken use case to Failing', async () => {
    await workspace.writeFile(projectId, 'package.json', JSON.stringify({ name: 'shop', private: true }));
    await workspace.writeFile(projectId, 'jest.config.js', jestConfig);
    await workspace.writeFile(projectId, 'src/application/services/OrderService.ts', [
      'export class OrderService {',
      '  // UC-001: Place Order (broken on purpose: ignores the quantity)',
      '  placeOrder(price: number, quantity: number): number { return price; }',
      '  // UC-002: Cancel Order',
      "  cancelOrder(status: string): string { if (status === 'SHIPPED') throw new Error('shipped'); return 'CANCELLED'; }",
      '}',
    ].join('\n'));
    await workspace.writeFile(projectId, 'tests/UC-001.spec.ts', [
      "import { OrderService } from '../src/application/services/OrderService';",
      "describe('UC-001: Place Order', () => {",
      "  it('charges price x quantity', () => { expect(new OrderService().placeOrder(10, 3)).toBe(30); });",
      '});',
    ].join('\n'));
    await workspace.writeFile(projectId, 'tests/UC-002.spec.ts', [
      "import { OrderService } from '../src/application/services/OrderService';",
      "describe('UC-002: Cancel Order', () => {",
      "  it('cancels a paid order', () => { expect(new OrderService().cancelOrder('PAID')).toBe('CANCELLED'); });",
      "  it('rejects a shipped order', () => { expect(() => new OrderService().cancelOrder('SHIPPED')).toThrow(); });",
      '});',
    ].join('\n'));
    const before = await workspace.listFiles(projectId);

    const summary = await new ProjectTestRunner(sandbox, workspace).run(projectId, useCases, {
      allowLocal: true,
      localNodeModules: path.join(__dirname, '../../../node_modules'),
    });

    expect(summary).toEqual(expect.objectContaining({ executed: true, mode: 'local', passed: 2, failed: 1 }));
    expect(summary.byUseCase['UC-001'].failingTests[0]).toMatch(/^UC-001: Place Order charges price x quantity: /);
    expect(summary.byUseCase['UC-002']).toEqual(expect.objectContaining({ passed: 2, failed: 0 }));
    // The run never writes into the project folder
    expect(await workspace.listFiles(projectId)).toEqual(before);

    const report = new TraceabilityService().build(useCases.slice(0, 2), [], [], summary);
    expect(report.rows.map(r => r.coverage)).toEqual(['Failing', 'Passing']);
    expect(TraceabilityService.qcPassed(report)).toBe(false);
  }, 120000);
});
