import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { IsBooleanString, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Permission } from '@ai-corp/shared-types';
import { AuditLogFilter } from '../../domain/audit';
import { RequirePermission } from '../access/access.decorators';
import { AuditLogService } from './audit-log.service';

export class AuditQueryDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() resourceType?: string;
  @IsOptional() @IsString() resourceId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsBooleanString() success?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class AnomalyQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720) hours?: number;
}

/**
 * Audit trail API (Phase 5, Task 21) — admin only (audit:view).
 */
@Controller('audit')
@RequirePermission(Permission.AUDIT_VIEW)
export class AuditController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  async list(@Query() q: AuditQueryDto) {
    const page = await this.audit.query(toFilter(q), q.page ?? 1, q.pageSize ?? 50);
    return { ...page, items: page.items.map(e => e.toPrimitives()) };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@Query() q: AuditQueryDto): Promise<StreamableFile> {
    const csv = await this.audit.exportCsv(toFilter(q));
    // BOM so Excel opens UTF-8 (Vietnamese names) correctly
    return new StreamableFile(Buffer.from('﻿' + csv, 'utf8'), {
      disposition: `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }

  @Get('anomalies')
  anomalies(@Query() q: AnomalyQueryDto) {
    return this.audit.detectAnomalies(q.hours ?? 24);
  }
}

function toFilter(q: AuditQueryDto): AuditLogFilter {
  return {
    userId: q.userId || undefined,
    action: q.action || undefined,
    resourceType: q.resourceType || undefined,
    resourceId: q.resourceId || undefined,
    projectId: q.projectId || undefined,
    success: q.success === undefined ? undefined : q.success === 'true',
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    search: q.search || undefined,
  };
}
