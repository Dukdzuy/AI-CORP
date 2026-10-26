import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import { CostBucket, ExportedFile, IProjectExporter, ProjectExportSnapshot, exportBaseName } from '../../domain/reporting';

/** Fonts with Vietnamese glyphs, tried in order (Linux, Windows, macOS); PDF_FONT_PATH wins */
const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
  'C:\\Windows\\Fonts\\segoeui.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial Unicode.ttf',
];

const COLORS = { text: '#1f2328', muted: '#57606a', accent: '#1677ff', rule: '#d0d7de', ok: '#1a7f37', bad: '#cf222e' };
const BAR_COLORS = ['#1677ff', '#13c2c2', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#fa541c', '#2f54eb'];

/**
 * Formatted project report as PDF (Phase 5, Task 23): summary, OOAD quality, cost with a
 * bar chart, agent performance, milestones, tasks and workflow runs.
 *
 * Without a Unicode font the built-in Helvetica is used and Vietnamese diacritics are
 * folded to ASCII, so the PDF is still readable.
 */
@Injectable()
export class PdfProjectExporter implements IProjectExporter {
  readonly format = 'pdf' as const;
  private readonly logger = new Logger(PdfProjectExporter.name);
  private readonly fontPath: string | null;

  constructor() {
    const candidates = [process.env.PDF_FONT_PATH, ...FONT_CANDIDATES].filter((p): p is string => !!p);
    this.fontPath = candidates.find(p => existsSync(p)) ?? null;
    if (!this.fontPath) this.logger.warn('No Unicode font found for PDF export; set PDF_FONT_PATH. Diacritics will be folded.');
  }

  async export(snapshot: ProjectExportSnapshot): Promise<ExportedFile> {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `AI Corp report: ${snapshot.project.name}`, Author: 'AI Corp Platform' } });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    if (this.fontPath) doc.font(this.fontPath);
    const t = (s: unknown) => this.text(s);

    this.render(doc, snapshot, t);
    doc.end();

    return { content: await done, contentType: 'application/pdf', fileName: `${exportBaseName(snapshot)}.pdf` };
  }

  private render(doc: PDFKit.PDFDocument, s: ProjectExportSnapshot, t: (v: unknown) => string) {
    const p = s.project;
    doc.fillColor(COLORS.accent).fontSize(9).text(t('AI CORP PLATFORM · PROJECT REPORT'));
    doc.moveDown(0.3).fillColor(COLORS.text).fontSize(20).text(t(p.name));
    doc.fillColor(COLORS.muted).fontSize(9).text(t(`Exported ${s.exportedAt.replace('T', ' ').slice(0, 16)} UTC by ${s.exportedBy}`));
    doc.moveDown(0.8);

    this.keyValues(doc, t, [
      ['Status', p.status],
      ['Owner', p.owner],
      ['Created', p.createdAt.slice(0, 10)],
      ['Budget', p.budget !== null ? `$${p.budget.toFixed(2)}` : 'none'],
      ['Cost accrued', `$${p.costAccrued.toFixed(4)}${s.cost.budgetUsed !== null ? ` (${(s.cost.budgetUsed * 100).toFixed(1)}% of budget)` : ''}`],
    ]);
    doc.moveDown(0.5).fillColor(COLORS.text).fontSize(10).text(t(p.goal || p.description), { width: 500 });

    this.heading(doc, t, 'OOAD quality');
    const lastGate = s.qualityGates[s.qualityGates.length - 1];
    this.keyValues(doc, t, [
      ['Use cases', String(s.ooad.useCases)],
      ['Traceability coverage', s.ooad.traceabilityCoverage !== null ? `${Math.round(s.ooad.traceabilityCoverage)}%` : 'not measured'],
      ['Quality gate', lastGate ? `${lastGate.gateId}: ${lastGate.passed ? 'passed' : 'failed'} (${s.qualityGates.length} evaluations)` : 'not evaluated'],
      ['Generated artifacts', `${s.ooad.artifacts} files`],
    ]);

    this.heading(doc, t, 'Cost by agent');
    this.barChart(doc, t, s.cost.byAgent);
    this.table(doc, t, ['Agent', 'Calls', 'Tokens', 'Cost (USD)', 'Share'], [150, 60, 80, 90, 60],
      s.cost.byAgent.map(b => [b.key, b.calls, b.tokens, b.cost.toFixed(4), `${(b.share * 100).toFixed(1)}%`]));
    doc.moveDown(0.5);
    this.table(doc, t, ['Model', 'Calls', 'Tokens', 'Cost (USD)'], [230, 60, 80, 90],
      s.cost.byModel.map(b => [b.key, b.calls, b.tokens, b.cost.toFixed(4)]));

    this.heading(doc, t, 'Agent performance');
    this.table(doc, t, ['Role / node', 'Runs', 'Success', 'Avg ms', 'p95 ms', 'Retries'], [150, 50, 70, 80, 80, 60],
      s.performance.byRole.map(r => [r.role, r.executions, r.successRate === null ? "–" : `${(r.successRate * 100).toFixed(0)}%`, r.avgDurationMs, r.p95DurationMs, r.retries]));

    if (s.milestones.length) {
      this.heading(doc, t, `Milestones (${s.milestones.length})`);
      this.table(doc, t, ['Milestone', 'Status', 'Due'], [300, 100, 90], s.milestones.map(m => [m.title, m.status, m.dueDate?.slice(0, 10) ?? '']));
    }

    this.heading(doc, t, `Tasks (${s.tasks.length})`);
    this.table(doc, t, ['Task', 'Status', 'Agent', 'Priority'], [280, 80, 80, 60], s.tasks.map(x => [x.title, x.status, x.assignedAgent ?? '', x.priority]));

    this.heading(doc, t, 'Workflow runs');
    this.table(doc, t, ['Definition', 'Status', 'Started', 'Steps'], [250, 80, 110, 50],
      s.workflowRuns.map(r => [r.definition, r.status, r.startedAt.replace('T', ' ').slice(0, 16), r.steps]));
  }

  private heading(doc: PDFKit.PDFDocument, t: (v: unknown) => string, title: string) {
    this.ensureSpace(doc, 60);
    doc.moveDown(1).fillColor(COLORS.accent).fontSize(13).text(t(title), 48);
    const y = doc.y + 2;
    doc.moveTo(48, y).lineTo(547, y).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
  }

  private keyValues(doc: PDFKit.PDFDocument, t: (v: unknown) => string, rows: Array<[string, string]>) {
    for (const [k, v] of rows) {
      const y = doc.y;
      doc.fillColor(COLORS.muted).fontSize(9).text(t(k), 48, y, { width: 140 });
      doc.fillColor(COLORS.text).fontSize(10).text(t(v), 190, y, { width: 357 });
    }
    doc.x = 48;
  }

  private barChart(doc: PDFKit.PDFDocument, t: (v: unknown) => string, buckets: CostBucket[]) {
    if (!buckets.length) {
      doc.fillColor(COLORS.muted).fontSize(9).text(t('No LLM usage recorded yet.'), 48);
      return;
    }
    // Free models cost nothing: chart tokens then, so the bars still compare the agents
    const byTokens = buckets.every(b => b.cost === 0);
    const value = (b: CostBucket) => (byTokens ? b.tokens : b.cost);
    const max = Math.max(...buckets.map(value), 1e-9);
    if (byTokens) doc.fillColor(COLORS.muted).fontSize(8).text(t('All calls were free; bars show tokens.'), 48);
    this.ensureSpace(doc, buckets.length * 16 + 10);
    let y = doc.y;
    buckets.slice(0, 10).forEach((b, i) => {
      const width = Math.max(2, (value(b) / max) * 300);
      doc.fillColor(COLORS.text).fontSize(8).text(t(b.key), 48, y + 2, { width: 90 });
      doc.rect(140, y, width, 11).fill(BAR_COLORS[i % BAR_COLORS.length]);
      const label = byTokens ? `${b.tokens} tokens` : `$${b.cost.toFixed(4)}`;
      doc.fillColor(COLORS.muted).fontSize(8).text(label, 140 + width + 6, y + 2);
      y += 16;
    });
    doc.x = 48;
    doc.y = y + 6;
  }

  private table(doc: PDFKit.PDFDocument, t: (v: unknown) => string, header: string[], widths: number[], rows: unknown[][]) {
    if (!rows.length) {
      doc.fillColor(COLORS.muted).fontSize(9).text(t('None.'), 48);
      return;
    }
    const line = (cells: unknown[], bold: boolean) => {
      this.ensureSpace(doc, 16);
      const y = doc.y;
      let x = 48;
      let height = 0;
      cells.forEach((c, i) => {
        doc.fillColor(bold ? COLORS.muted : COLORS.text).fontSize(bold ? 8 : 9);
        const text = t(c);
        doc.text(text, x, y, { width: widths[i] - 6, lineBreak: true });
        height = Math.max(height, doc.heightOfString(text, { width: widths[i] - 6 }));
        x += widths[i];
      });
      doc.x = 48;
      doc.y = y + height + 4;
    };
    line(header, true);
    rows.forEach(r => line(r, false));
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
  }

  private text(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    if (this.fontPath) return s;
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7E\n]/g, '?');
  }
}
