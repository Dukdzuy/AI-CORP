import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PROJECT_EXPORTERS } from '../../domain/reporting';
import { CsvProjectExporter, JsonProjectExporter, PdfProjectExporter } from '../../infrastructure/export';
import { ProjectReportingService } from './project-reporting.service';
import { ProjectExportService } from './project-export.service';
import { WeeklyReportScheduler } from './weekly-report.scheduler';
import { ReportsController } from './reports.controller';

/**
 * Reporting & export (Phase 5, Task 23).
 */
@Module({
  imports: [WorkspaceModule],
  controllers: [ReportsController],
  providers: [
    ProjectReportingService,
    ProjectExportService,
    WeeklyReportScheduler,
    JsonProjectExporter,
    CsvProjectExporter,
    PdfProjectExporter,
    {
      provide: PROJECT_EXPORTERS,
      useFactory: (json: JsonProjectExporter, csv: CsvProjectExporter, pdf: PdfProjectExporter) => [json, csv, pdf],
      inject: [JsonProjectExporter, CsvProjectExporter, PdfProjectExporter],
    },
  ],
  exports: [ProjectReportingService, ProjectExportService],
})
export class ReportingModule {}
