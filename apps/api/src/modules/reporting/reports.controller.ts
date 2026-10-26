import { Controller, Get, HttpCode, Param, Post, Query, StreamableFile } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { ProjectReportingService } from './project-reporting.service';
import { ProjectExportService } from './project-export.service';
import { WeeklyReportScheduler } from './weekly-report.scheduler';

export class ExportQueryDto {
  @IsIn(['json', 'csv', 'pdf'])
  format!: string;
}

export class PerformanceQueryDto {
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
}

/**
 * Reports and exports (Phase 5, Task 23).
 */
@Controller()
export class ReportsController {
  constructor(
    private readonly reporting: ProjectReportingService,
    private readonly exports: ProjectExportService,
    private readonly scheduler: WeeklyReportScheduler
  ) {}

  @Get('reports/projects/:id/cost')
  @RequirePermission(Permission.REPORT_VIEW)
  cost(@Param('id') id: string) {
    return this.reporting.costReport(id);
  }

  @Get('reports/performance')
  @RequirePermission(Permission.REPORT_VIEW)
  performance(@Query() q: PerformanceQueryDto) {
    return this.reporting.performanceReport(q);
  }

  /** Runs the weekly report job now (normally it runs on its own schedule) */
  @Post('reports/weekly/run')
  @HttpCode(200)
  @RequirePermission(Permission.USER_MANAGE)
  @Audited({ action: 'report.weekly_run', resourceType: 'Report' })
  runWeekly() {
    return this.scheduler.runOnce();
  }

  @Get('projects/:id/export')
  @RequirePermission(Permission.PROJECT_EXPORT)
  @Audited({ action: 'project.export', resourceType: 'ProjectExport', idParam: 'id', projectIdParam: 'id' })
  async export(@Param('id') id: string, @Query() q: ExportQueryDto, @CurrentPrincipal() principal: Principal): Promise<StreamableFile> {
    return toFile(await this.exports.export(id, q.format, principal.label()));
  }
}

export function toFile(file: { content: Buffer; contentType: string; fileName: string }): StreamableFile {
  return new StreamableFile(file.content, {
    type: file.contentType,
    disposition: `attachment; filename="${file.fileName}"`,
    length: file.content.length,
  });
}
