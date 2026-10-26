import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../domain/events/EventBus';
import { DomainEvent } from '../../domain/events/DomainEvent';
import { AgentCompletedTaskEvent } from '../../domain/events/AgentCompletedTaskEvent';
import { QualityGateEvaluatedEvent } from '../../domain/events/QualityGateEvaluatedEvent';
import { ExecutionOutcome } from '../../domain/agent/learning/ExecutionOutcome';
import { OutcomeSignalPolicy } from './outcome-signal.policy';
import { LearningService } from './learning.service';

/**
 * AgentLearningHandler (Observer)
 *
 * Listens to agent.task.completed and quality.gate.evaluated, turns them into graded outcomes
 * (OutcomeSignalPolicy) and stores them (LearningService). Refinement runs in the background:
 * EventBus.publish awaits its handlers, and an LLM call must not hold up the workflow.
 */
@Injectable()
export class AgentLearningHandler implements IEventHandler<DomainEvent> {
  static readonly EVENT_TYPES = ['agent.task.completed', 'quality.gate.evaluated'];

  private readonly logger = new Logger(AgentLearningHandler.name);
  private readonly policy = new OutcomeSignalPolicy();
  /** Background refinements, kept so tests and shutdown can wait for them */
  readonly pending = new Set<Promise<unknown>>();

  constructor(private readonly learning: LearningService) {}

  async handle(event: DomainEvent): Promise<void> {
    let outcomes: ExecutionOutcome[] = [];
    if (event instanceof QualityGateEvaluatedEvent || event.eventType === 'quality.gate.evaluated') {
      outcomes = this.policy.fromGate(event as QualityGateEvaluatedEvent);
    } else if (event instanceof AgentCompletedTaskEvent || event.eventType === 'agent.task.completed') {
      outcomes = this.policy.fromAgentCompleted(event as AgentCompletedTaskEvent);
    }

    for (const outcome of outcomes) {
      try {
        const { shouldRefine } = await this.learning.recordOutcome(outcome);
        if (shouldRefine) this.refineInBackground(outcome.role);
      } catch (error) {
        this.logger.warn(`Could not record ${outcome.signal} outcome for ${outcome.role}: ${(error as Error).message}`);
      }
    }
  }

  private refineInBackground(role: string): void {
    const job = this.learning
      .refine(role)
      .then(id => id && this.logger.log(`Refined lessons for ${role} (memory ${id})`))
      .catch(error => this.logger.warn(`Refinement for ${role} failed: ${(error as Error).message}`))
      .finally(() => this.pending.delete(job));
    this.pending.add(job);
  }
}
