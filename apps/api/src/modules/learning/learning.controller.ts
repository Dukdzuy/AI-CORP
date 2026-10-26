import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLE_PROFILES } from '../agents/profiles';
import { LearningService } from './learning.service';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  /** GET /api/agents/:role/learning: success rate over time and top lessons (Agent Detail page) */
  @Get(':role/learning')
  async learningStats(@Param('role') role: string, @Query('days') days?: string) {
    const upper = role.toUpperCase();
    if (!ROLE_PROFILES.some(p => p.role === upper)) {
      throw new NotFoundException(`Unknown agent role: ${role}`);
    }
    const window = Math.min(Math.max(parseInt(days || '30', 10) || 30, 1), 365);
    return this.learning.stats(upper, window);
  }
}
