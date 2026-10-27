import { Module, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../domain/events/EventBus';
import { TASK_COST_ESTIMATOR } from '../../domain/estimation';
import { TrainingDataCollector } from './training-data.collector';
import { ProjectEstimationService } from './project-estimation.service';
import { EstimationHandler } from './estimation.handler';
import { EstimationController } from './estimation.controller';

/**
 * Estimation (Phase 6, Task 25). Provides the ITaskCostEstimator port to the workflow
 * engine, which uses it when the PM agent creates tasks.
 */
@Module({
  controllers: [EstimationController],
  providers: [
    TrainingDataCollector,
    ProjectEstimationService,
    EstimationHandler,
    { provide: TASK_COST_ESTIMATOR, useExisting: ProjectEstimationService },
  ],
  exports: [ProjectEstimationService, TASK_COST_ESTIMATOR],
})
export class EstimationModule implements OnModuleInit {
  constructor(private readonly eventBus: EventBus, private readonly handler: EstimationHandler) {}

  onModuleInit(): void {
    for (const eventType of EstimationHandler.EVENT_TYPES) this.eventBus.subscribe(eventType, this.handler);
  }
}
