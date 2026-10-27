import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../domain/events/EventBus';
import { DomainEvent } from '../../domain/events/DomainEvent';
import { WorkflowStartedEvent } from '../../domain/events/WorkflowStartedEvent';
import { ProjectEstimationService } from './project-estimation.service';

/**
 * Stores a forecast when a project's workflow starts (Phase 6, Task 25), so the outcome
 * can be compared with what was predicted before any agent ran.
 *
 * @pattern Observer
 */
@Injectable()
export class EstimationHandler implements IEventHandler {
  static readonly EVENT_TYPES = ['workflow.started'];
  private readonly logger = new Logger(EstimationHandler.name);

  constructor(private readonly estimation: ProjectEstimationService) {}

  async handle(event: DomainEvent): Promise<void> {
    const started = event as WorkflowStartedEvent;
    try {
      await this.estimation.record(started.projectId, 'start');
    } catch (err: any) {
      this.logger.warn(`Could not store the start forecast of project ${started.projectId}: ${err.message}`);
    }
  }
}
