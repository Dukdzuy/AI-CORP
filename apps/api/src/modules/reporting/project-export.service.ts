import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '@ai-corp/shared-types';
import { ExportedFile, IProjectExporter, PROJECT_EXPORTERS } from '../../domain/reporting';
import { ProjectReportingService } from './project-reporting.service';

/**
 * Exports a project in the requested format (Phase 5, Task 23). Gathers the snapshot once
 * and hands it to the exporter registered for the format.
 *
 * @pattern Strategy (exporters), Registry
 * @principle Open/Closed - a new format is a new IProjectExporter provider
 */
@Injectable()
export class ProjectExportService {
  private readonly exporters: Map<ExportFormat, IProjectExporter>;

  constructor(
    private readonly reporting: ProjectReportingService,
    @Inject(PROJECT_EXPORTERS) exporters: IProjectExporter[]
  ) {
    this.exporters = new Map(exporters.map(e => [e.format, e]));
  }

  formats(): ExportFormat[] {
    return [...this.exporters.keys()];
  }

  async export(projectId: string, format: string, exportedBy: string): Promise<ExportedFile> {
    const exporter = this.exporters.get(format as ExportFormat);
    if (!exporter) throw new BadRequestException(`Unknown export format '${format}'. Use one of: ${this.formats().join(', ')}`);
    const snapshot = await this.reporting.snapshot(projectId, exportedBy);
    return exporter.export(snapshot);
  }
}
