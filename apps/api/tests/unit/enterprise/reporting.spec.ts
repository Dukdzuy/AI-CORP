import fs from 'fs';
import os from 'os';
import path from 'path';
import { BadRequestException, Logger, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { CostReportBuilder, PerformanceReportBuilder, ProjectExportSnapshot } from '../../../src/domain/reporting';
import { ReportGeneratedEvent } from '../../../src/domain/events/ReportGeneratedEvent';
import { CsvProjectExporter, JsonProjectExporter, PdfProjectExporter } from '../../../src/infrastructure/export';
import { ProjectExportService } from '../../../src/modules/reporting/project-export.service';
import { WeeklyReportScheduler } from '../../../src/modules/reporting/weekly-report.scheduler';
import { ProjectWorkspace } from '../../../src/modules/workspace/project-workspace.service';
import { IntegrationV1Controller } from '../../../src/modules/integrations/integration-v1.controller';
import { ProjectApplicationService } from '../../../src/modules/projects/project-application.service';
import { ProjectReportingService } from '../../../src/modules/reporting/project-reporting.service';
import { IntegrationsService } from '../../../src/modules/integrations/integrations.service';

function snapshot(): ProjectExportSnapshot {
  const now = new Date('2026-10-26T08:00:00Z');
  return {
    exportedAt: now.toISOString(),
    exportedBy: 'alice@x.com',
    project: { id: 'p1', name: 'Thư viện số', description: 'Mượn sách', goal: 'Quản lý thư viện', status: 'active', budget: 10, costAccrued: 0.42, createdAt: now.toISOString(), owner: 'alice@x.com' },
    milestones: [{ id: 'm1', title: 'MVP', status: 'pending', dueDate: null }],
    tasks: [
      { id: 't1', title: 'UC-001: Mượn sách, "nhanh"', status: 'done', priority: 'high', assignedAgent: 'DEV', milestone: 'MVP', actualCost: 0.2, createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { id: 't2', title: '=cmd|calc', status: 'todo', priority: 'low', assignedAgent: null, milestone: null, actualCost: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    ],
    workflowRuns: [{ id: 'r1', definition: 'ooad-software-project@1.0.0', status: 'running', startedAt: now.toISOString(), completedAt: null, steps: 4 }],
    qualityGates: [{ gateId: 'ooad_gate', passed: true, at: now.toISOString() }],
    ooad: { useCases: 5, traceabilityCoverage: 80, artifacts: 30 },
    cost: CostReportBuilder.build('p1', [{ agentRole: 'DEV', model: 'gpt', cost: 0.42, totalTokens: 900, responseTimeMs: 100, fallback: false, createdAt: now }], 10, now),
    performance: PerformanceReportBuilder.build('p1', [{ agentRole: 'DEV', nodeId: 'develop', status: 'completed', durationMs: 100, retryCount: 0 }], now),
  };
}

describe('Phase 5 / Task 23: exports, reports and the integration API contract', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  describe('exporters', () => {
    it('JSON: the whole snapshot', async () => {
      const file = await new JsonProjectExporter().export(snapshot());
      expect(file.fileName).toBe('thu-vien-so-2026-10-26.json');
      expect(JSON.parse(file.content.toString())).toEqual(snapshot());
    });

    it('CSV: one row per task, BOM for Excel, quoted and formula-safe', async () => {
      const file = await new CsvProjectExporter().export(snapshot());
      expect(file.fileName).toBe('thu-vien-so-2026-10-26-tasks.csv');
      const text = file.content.toString('utf8');
      expect(text.charCodeAt(0)).toBe(0xfeff);
      const lines = text.slice(1).trim().split('\r\n');
      expect(lines[0]).toBe('task_id,title,status,priority,assigned_agent,milestone,actual_cost_usd,created_at,updated_at');
      expect(lines[1]).toContain('"UC-001: Mượn sách, ""nhanh"""');
      expect(lines[2]).toContain(",'=cmd|calc,");
      expect(lines).toHaveLength(3);
    });

    it('PDF: a valid multi-section document, with or without a Unicode font', async () => {
      const file = await new PdfProjectExporter().export(snapshot());
      expect(file.contentType).toBe('application/pdf');
      expect(file.content.subarray(0, 5).toString()).toBe('%PDF-');
      expect(file.content.subarray(-6).toString()).toContain('%%EOF');

      const saved = process.env.PDF_FONT_PATH;
      process.env.PDF_FONT_PATH = '/nonexistent.ttf';
      const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const fallback = await new PdfProjectExporter().export(snapshot());
      exists.mockRestore();
      process.env.PDF_FONT_PATH = saved;
      expect(fallback.content.subarray(0, 5).toString()).toBe('%PDF-');
      expect(fallback.content.toString('latin1')).toContain('/Helvetica');
    });

    it('the export service picks the exporter by format and rejects unknown ones', async () => {
      const reporting = { snapshot: jest.fn(async () => snapshot()) };
      const service = new ProjectExportService(reporting as any, [new JsonProjectExporter(), new CsvProjectExporter()]);
      expect(service.formats()).toEqual(['json', 'csv']);
      expect((await service.export('p1', 'csv', 'alice@x.com')).contentType).toContain('text/csv');
      expect(reporting.snapshot).toHaveBeenCalledWith('p1', 'alice@x.com');
      await expect(service.export('p1', 'xlsx', 'a')).rejects.toThrow(BadRequestException);
    });
  });

  describe('WeeklyReportScheduler', () => {
    it('writes one report per active project per ISO week and raises ReportGeneratedEvent', async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-'));
      const workspace = new ProjectWorkspace(root);
      const s = snapshot();
      const reporting = {
        costReport: async () => s.cost,
        performanceReport: async () => s.performance,
        status: async () => ({ status: 'active', tasks: { done: 1, todo: 1 }, workflow: { status: 'running', currentNodeId: 'develop' }, traceabilityCoverage: 80 }),
      };
      const prisma = { project: { findMany: jest.fn(async () => [{ id: 'p1', name: 'Thư viện số' }]) } };
      const events = { publish: jest.fn(async () => undefined) };
      const scheduler = new WeeklyReportScheduler(prisma as any, reporting as any, workspace, events as any, { get: () => 0 } as any);

      const monday = new Date('2026-10-26T09:00:00Z');
      const first = await scheduler.runOnce(monday);
      expect(first).toEqual({ period: '2026-W44', generated: [{ projectId: 'p1', path: 'reports/weekly-2026-W44.md' }], skipped: 0 });
      const md = (await workspace.readFile('p1', 'reports/weekly-2026-W44.md'))!;
      expect(md).toContain('# Weekly report — Thư viện số (2026-W44)');
      expect(md).toContain('| DEV | 1 | 900 | 0.4200 |');
      expect(md).toContain('Traceability coverage: 80%');
      expect(events.publish).toHaveBeenCalledWith(expect.any(ReportGeneratedEvent));
      expect((events.publish.mock.calls[0] as any[])[0]).toMatchObject({ projectId: 'p1', period: '2026-W44', totalCost: 0.42 });

      // same week again (another tick, or after a restart): nothing new
      expect(await scheduler.runOnce(new Date('2026-11-01T22:00:00Z'))).toMatchObject({ generated: [], skipped: 1 });
      // next week: a new file
      expect((await scheduler.runOnce(new Date('2026-11-02T00:30:00Z'))).generated[0].path).toBe('reports/weekly-2026-W45.md');
      fs.rmSync(root, { recursive: true, force: true });
    });
  });

  describe('OpenAPI', () => {
    it('documents the /api/v1 routes with the api-key scheme', async () => {
      @Module({
        controllers: [IntegrationV1Controller],
        providers: [
          { provide: ProjectApplicationService, useValue: {} },
          { provide: ProjectReportingService, useValue: {} },
          { provide: ProjectExportService, useValue: {} },
          { provide: IntegrationsService, useValue: {} },
        ],
      })
      class V1Module {}
      const moduleRef = await Test.createTestingModule({ imports: [V1Module] }).compile();
      const app = moduleRef.createNestApplication({ logger: false });
      app.setGlobalPrefix('api');
      await app.init();
      const { createIntegrationOpenApiDocument } = await import('../../../src/modules/integrations/openapi');
      const doc = createIntegrationOpenApiDocument(app, [V1Module]);
      await app.close();

      expect(Object.keys(doc.paths).sort()).toEqual([
        '/api/v1/projects',
        '/api/v1/projects/{id}/export',
        '/api/v1/projects/{id}/reports/cost',
        '/api/v1/projects/{id}/status',
        '/api/v1/webhooks',
        '/api/v1/webhooks/{id}',
      ]);
      expect(doc.components?.securitySchemes?.['api-key']).toMatchObject({ type: 'apiKey', in: 'header', name: 'x-api-key' });
      const create = doc.paths['/api/v1/projects'].post!;
      expect(create.security).toEqual([{ 'api-key': [] }]);
      const schema = doc.components!.schemas!.IntegrationCreateProjectDto as any;
      expect(schema.required).toEqual(['name', 'description', 'goal']);
      expect(SwaggerModule).toBeDefined();
    });
  });
});
