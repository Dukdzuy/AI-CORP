import { TraceabilityService } from '../../../src/modules/agents/services/traceability.service';
import { QaActionStrategy } from '../../../src/modules/agents/strategies/QaActionStrategy';

describe('TraceabilityService', () => {
  const service = new TraceabilityService();
  const useCases = [
    { id: 'UC-001', name: 'Place Order', priority: 'High' },
    { id: 'UC-002', name: 'Cancel Order', priority: 'High' },
    { id: 'UC-003', name: 'Add Product', priority: 'Medium' },
  ];
  const files = [
    {
      path: 'src/application/services/OrderService.ts',
      content: '// UC-001: Place Order\nasync placeOrder() {}\n// UC-002: Cancel Order\nasync cancelOrder() {}',
    },
    { path: 'tests/UC-001.spec.ts', content: "describe('UC-001: Place Order', () => { it('main flow', () => {}); });" },
    { path: 'tests/cancel.test.ts', content: "describe('cancel order', () => { it('UC-002 rejects shipped orders', () => {}); });" },
  ];

  it('maps each use case to classes, implementation files and tests', () => {
    const report = service.build(useCases, ['Order', 'Product'], files);

    expect(report.rows[0]).toEqual(expect.objectContaining({
      useCaseId: 'UC-001',
      domainClasses: ['Order'],
      implementationFiles: ['src/application/services/OrderService.ts'],
      coverage: 'Covered',
    }));
    expect(report.rows[1].testCases).toContain('UC-002 rejects shipped orders');
    expect(report.rows[2]).toEqual(expect.objectContaining({ useCaseId: 'UC-003', coverage: 'Missing', domainClasses: ['Product'] }));
    expect(report.coveragePercent).toBe(66.7);
    expect(report.missingUseCases).toEqual(['UC-003']);
  });

  it('warns in the markdown when coverage is below 80%', () => {
    const report = service.build(useCases, [], files);
    expect(report.markdown).toContain('| UC-003 | Add Product | Medium |');
    expect(report.markdown).toContain('Missing tests for: UC-003');

    const full = service.build(useCases.slice(0, 2), [], files);
    expect(full.coveragePercent).toBe(100);
    expect(full.markdown).not.toContain('WARNING');
  });

  it('reports 0% coverage when there are no use cases', () => {
    expect(service.build([], [], files).coveragePercent).toBe(0);
  });

  it('parses use cases from the rendered use-cases.md', () => {
    const md = '## Use Case: Place Order\n\n| Field | Value |\n|---|---|\n| **ID** | UC-001 |\n| **Priority** | High |\n';
    expect(service.parseUseCasesMarkdown(md)).toEqual([{ id: 'UC-001', name: 'Place Order', priority: 'High' }]);
  });
});

describe('QaActionStrategy.verdict', () => {
  it('lets an explicit FAIL win, then PASS, then falls back to whether code exists', () => {
    expect(QaActionStrategy.verdict('findings...\nVERDICT: FAIL', true)).toBe(false);
    expect(QaActionStrategy.verdict('verdict:pass', false)).toBe(true);
    expect(QaActionStrategy.verdict('no verdict', true)).toBe(true);
    expect(QaActionStrategy.verdict('no verdict', false)).toBe(false);
  });
});
