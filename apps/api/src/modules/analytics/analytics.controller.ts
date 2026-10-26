import { Controller, Get, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { AgentAnalyticsService } from './agent-analytics.service';

export class AgentAnalyticsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
  @IsOptional() @IsString() projectId?: string;
}

/**
 * Agent performance analytics (Phase 6, Task 24).
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AgentAnalyticsService) {}

  /** Per-role metrics, trends, leaderboard, daily series, activity heatmap and anomalies */
  @Get('agents')
  @RequirePermission(Permission.REPORT_VIEW)
  agents(@Query() q: AgentAnalyticsQueryDto) {
    return this.analytics.analytics(q);
  }
}
