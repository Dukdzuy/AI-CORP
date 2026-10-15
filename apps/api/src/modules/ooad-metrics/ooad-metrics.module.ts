import { Module } from '@nestjs/common';
import { OoadMetricsService } from './ooad-metrics.service';
import { OoadMetricsController } from './ooad-metrics.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OoadMetricsService],
  controllers: [OoadMetricsController],
  exports: [OoadMetricsService]
})
export class OoadMetricsModule {}
