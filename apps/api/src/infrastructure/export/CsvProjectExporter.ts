import { Injectable } from '@nestjs/common';
import { ExportedFile, IProjectExporter, ProjectExportSnapshot, exportBaseName, toCsv } from '../../domain/reporting';

/**
 * Task list as CSV with each task's agent and cost, for spreadsheets (Phase 5, Task 23).
 * Starts with a UTF-8 BOM so Excel shows Vietnamese text correctly.
 */
@Injectable()
export class CsvProjectExporter implements IProjectExporter {
  readonly format = 'csv' as const;

  async export(snapshot: ProjectExportSnapshot): Promise<ExportedFile> {
    const csv = toCsv(
      ['task_id', 'title', 'status', 'priority', 'assigned_agent', 'milestone', 'actual_cost_usd', 'created_at', 'updated_at'],
      snapshot.tasks.map(t => [t.id, t.title, t.status, t.priority, t.assignedAgent, t.milestone, t.actualCost, t.createdAt, t.updatedAt])
    );
    return {
      content: Buffer.from('\uFEFF' + csv, 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      fileName: `${exportBaseName(snapshot)}-tasks.csv`,
    };
  }
}
