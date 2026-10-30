import { Logger, OnModuleDestroy } from '@nestjs/common';
import { AgentRole, AgentThinkingEvent } from '@ai-corp/shared-types';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { IAgent } from '../../domain/agent/interfaces/IAgent.interface';
import { IAgentObserver, StateChangedEvent } from '../../domain/agent/interfaces/IAgentObserver.interface';
import { IThinkingStrategy } from '../../domain/agent/interfaces/IThinkingStrategy.interface';
import { IActionStrategy } from '../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentResult } from '../../domain/common/types';
import { AgentStateMachine } from '../../domain/agent/AgentStateMachine';
import { AgentEventEmitter } from '../../domain/agent/AgentEventEmitter';
import { AgentState } from '../../domain/agent/AgentState';
import { EventBus } from '../../domain/events/EventBus';
import { TaskAssignedEvent } from '../../domain/events/TaskAssignedEvent';
import { TaskCompletedEvent } from '../../domain/events/TaskCompletedEvent';
import { AgentCompletedTaskEvent } from '../../domain/events/AgentCompletedTaskEvent';
import { AgentErrorEvent } from '../../domain/events/AgentErrorEvent';
import { RoleProfile } from './profiles/role-profile';

/**
 * BaseAgent
 *
 * The one agent contract (IAgent) shared by every role. A concrete agent only supplies its
 * RoleProfile and its thinking/action strategies; everything else (state machine, domain
 * events, WebSocket updates, error classification) lives here.
 *
 * There is one agent instance per role, but several workflow runs can use it at the same
 * time, so every execute() walks its own state machine (one task lifecycle). The agent's
 * state is the state of its most recent task that is still running, else of the last one.
 * (Phase 6 fix: a single shared machine made concurrent runs fail with "Invalid state
 * transition" and left the role unusable after a permanent error.)
 *
 * @pattern Template Method (execute: assign → think → act → complete), State (AgentStateMachine),
 *          Strategy (IThinkingStrategy / IActionStrategy), Observer (AgentEventEmitter)
 */
export abstract class BaseAgent<TOutput = unknown> implements IAgent, OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);
  /** Lifecycle of the most recent task */
  protected stateMachine: AgentStateMachine;
  /** Lifecycles of the tasks in progress, oldest first */
  private readonly running = new Set<AgentStateMachine>();
  protected readonly eventEmitter: AgentEventEmitter;

  constructor(
    protected readonly profile: RoleProfile,
    protected readonly thinkingStrategy: IThinkingStrategy,
    protected readonly actionStrategy: IActionStrategy<TOutput>,
    protected readonly websocketGateway: AppWebSocketGateway,
    protected readonly eventBus: EventBus,
    stateMachine?: AgentStateMachine,
    eventEmitter?: AgentEventEmitter
  ) {
    this.stateMachine = stateMachine || new AgentStateMachine(AgentState.IDLE);
    this.eventEmitter = eventEmitter || new AgentEventEmitter();
  }

  /** The role is the agent's identity: one agent instance per role */
  getId(): string {
    return this.profile.role;
  }

  getRole(): AgentRole {
    return this.profile.role;
  }

  getProfile(): RoleProfile {
    return this.profile;
  }

  getState(): AgentState {
    const active = [...this.running];
    return (active[active.length - 1] ?? this.stateMachine).getCurrentState();
  }

  addEventListener(observer: IAgentObserver): void {
    this.eventEmitter.addObserver(observer);
  }

  removeEventListener(observer: IAgentObserver): void {
    this.eventEmitter.removeObserver(observer);
  }

  /**
   * Lifecycle cleanup (NestJS OnModuleDestroy hook): clears observer references so a torn-down
   * module does not leak them.
   */
  onModuleDestroy() {
    this.logger.debug(`Cleaning up agent ${this.getRole()} - clearing observers`);
    this.eventEmitter.clearObservers();
  }

  /** Manual cleanup for an agent that is decommissioned while the module keeps running */
  cleanup(): void {
    this.logger.debug(`Manual cleanup for agent ${this.getRole()}`);
    this.eventEmitter.clearObservers();
  }

  /**
   * Execute the think → act cycle (Template Method).
   *
   * State flow:
   * - IDLE → THINKING (before thinkingStrategy.think())
   * - THINKING → ACTING (after think(), before actionStrategy.act())
   * - ACTING → COMPLETED (after a successful act())
   * - COMPLETED → IDLE (ready for the next task)
   * - any state → ERROR on exception; ERROR → IDLE only for transient errors
   *
   * The context's taskType is resolved against the role profile first, so strategies always
   * receive a task type their role supports.
   */
  async execute(input: AgentContext): Promise<AgentResult<TOutput>> {
    const context = this.prepareContext(input);
    const role = this.getRole();
    const agentId = this.getId();
    const projectId = context.projectId || 'unknown';
    const taskId = context.taskId || 'unknown';
    const taskTitle = context.task || context.taskType || 'Untitled Task';
    const startTime = Date.now();
    const lifecycle = new AgentStateMachine(AgentState.IDLE);
    this.stateMachine = lifecycle;
    this.running.add(lifecycle);
    const transition = (to: AgentState, reason: string) => this.transition(lifecycle, to, projectId, reason);

    try {
      await this.publish(new TaskAssignedEvent(taskId, projectId, role, taskTitle, context.priority));

      transition(AgentState.THINKING, 'Starting thought process');
      const thought = await this.thinkingStrategy.think(context);
      this.emitThinking(projectId, taskId, thought.reasoning);
      this.eventEmitter.emitThinkingCompleted({ agentId, agentRole: role, taskId, thought, timestamp: new Date() });

      transition(AgentState.ACTING, 'Executing action based on thought');
      const action = await this.actionStrategy.act(context, thought);
      this.eventEmitter.emitActionCompleted({
        agentId,
        agentRole: role,
        taskId,
        actionType: context.taskType || this.profile.defaultTaskType,
        toolName: thought.plannedActions[0]?.toolName || 'llm',
        parameters: {},
        result: action,
        timestamp: new Date(),
      });

      transition(AgentState.COMPLETED, 'Task completed successfully');

      const executionTimeMs = Date.now() - startTime;
      await this.publish(new TaskCompletedEvent(taskId, projectId, role, taskTitle, executionTimeMs, { thought, action }));
      await this.publish(new AgentCompletedTaskEvent(agentId, taskId, projectId, { thought, action }));

      transition(AgentState.IDLE, 'Agent ready for next task');
      return { thought, action };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedIn = lifecycle.getCurrentState();
      transition(AgentState.ERROR, `Error during execution: ${message}`);

      this.eventEmitter.emitError({
        agentId,
        agentRole: role,
        taskId,
        error: error instanceof Error ? error : new Error(message),
        timestamp: new Date(),
        context: { projectId, currentState: failedIn.toString() },
      });
      await this.publish(new AgentErrorEvent(agentId, taskId, projectId, message));
      this.logger.error(`Agent ${role} execution error: ${message}`, error instanceof Error ? error.stack : undefined);

      // Transient errors (timeouts, rate limits) leave the agent reusable; permanent ones keep it in ERROR
      if (this.isTransientError(error)) {
        transition(AgentState.IDLE, 'Agent reset after transient error');
      }
      throw error;
    } finally {
      this.running.delete(lifecycle);
    }
  }

  /** Resolve the task type for this role (unknown types fall back to the role's default) */
  protected prepareContext(input: AgentContext): AgentContext {
    const taskType = this.profile.resolveTaskType(input.taskType);
    if (input.taskType && input.taskType !== taskType) {
      this.logger.warn(
        `Role ${this.getRole()} does not support task type '${input.taskType}' ` +
        `(supported: ${this.profile.taskTypes.join(', ')}); using '${taskType}'`
      );
    }
    return { ...input, taskType };
  }

  /**
   * Classify errors as transient (retryable) or permanent (non-retryable).
   * Transient: network timeouts, rate limits, temporary outages.
   * Permanent: authentication failures, missing dependencies, invalid configuration.
   */
  protected isTransientError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();

    const transient = ['timeout', 'econnrefused', 'enotfound', 'rate limit', '503', '504', 'connection reset'];
    if (transient.some(t => message.includes(t))) return true;

    const permanent = ['authentication', 'authorization', 'api key', 'not found', 'does not exist', 'invalid config', 'missing dependency'];
    if (permanent.some(p => message.includes(p))) return false;

    // Default: treat as transient so the agent can be retried
    return true;
  }

  private async publish(event: Parameters<EventBus['publish']>[0]): Promise<void> {
    await this.eventBus
      .publish(event)
      .catch(err => this.logger.error(`Failed to publish ${event.constructor.name}: ${err.message}`));
  }

  private transition(lifecycle: AgentStateMachine, to: AgentState, projectId: string, reason: string): void {
    const from = lifecycle.getCurrentState();
    lifecycle.transitionTo(to, reason);
    this.emitStateChanged(from, to, projectId, reason);
  }

  /** Emit an agent thinking event to the project room and to the Virtual Office */
  protected emitThinking(projectId: string, taskId: string, thought: string) {
    const event: AgentThinkingEvent = {
      projectId,
      agentId: this.getId(),
      agentRole: this.getRole(),
      taskId,
      message: thought,
    } as AgentThinkingEvent;
    this.websocketGateway.sendToProject(projectId, { type: 'agent:thinking', payload: event });
    this.websocketGateway.broadcastEvent({ type: 'agent:thinking', payload: event });
  }

  /** Emit a state change via AgentEventEmitter (observers) and WebSocket (UI) */
  protected emitStateChanged(previousState: AgentState, currentState: AgentState, projectId: string, reason?: string) {
    const event: StateChangedEvent & { projectId: string } = {
      projectId,
      agentId: this.getId(),
      agentRole: this.getRole(),
      previousState,
      currentState,
      timestamp: new Date(),
      reason,
    };

    this.eventEmitter.emitStateChanged(event);
    this.websocketGateway.sendToProject(projectId, { type: 'agent:state_changed', payload: event });
    this.websocketGateway.broadcastEvent({ type: 'agent:state_changed', payload: event });
    this.logger.debug(`Agent ${this.getRole()} state: ${previousState} → ${currentState}${reason ? ` (${reason})` : ''}`);
  }
}
