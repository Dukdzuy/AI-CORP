import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OoadMetricsService } from './ooad-metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/ooad-metrics')
@UseGuards(JwtAuthGuard)
export class OoadMetricsController {
  constructor(private readonly ooadMetricsService: OoadMetricsService) {}

  @Get('dashboard')
  async getDashboard() {
    const [allProjects, aggregate] = await Promise.all([
      this.ooadMetricsService.getAllProjectsMetrics(),
      this.ooadMetricsService.getAggregateMetrics()
    ]);

    return {
      aggregate,
      projects: allProjects
    };
  }

  @Get('project/:id')
  async getProjectMetrics(@Param('id') projectId: string) {
    const metrics = await this.ooadMetricsService.getProjectMetrics(projectId);
    if (!metrics) {
      return { error: 'Project not found' };
    }
    return metrics;
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('metric') metric: 'testCoverage' | 'gatePassRate' | 'useCaseCount' = 'testCoverage',
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.ooadMetricsService.getLeaderboard(metric, limitNum);
  }
}
