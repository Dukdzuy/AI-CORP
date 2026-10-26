import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { NodeResult, WorkflowNode } from '@ai-corp/shared-types';
import { AclMessage, Performative } from '../../../domain/collaboration/AclMessage';
import { AgentMessageBus } from '../../orchestrator/agent-message.bus';
import { NodeExecutionContext, NodeExecutionStrategy } from '../strategies/node-execution-strategy';
import { AgentTaskStrategy } from '../strategies/agent-task.strategy';
import { WorkflowEngine } from '../workflow.engine';
import { IWorkflowEngineRepository, WORKFLOW_ENGINE_REPOSITORY, WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { CollaborationContext, TurnOutput } from './collaboration-strategy';
import { CollaborationRegistry } from './collaboration.registry';
import { PairDevelopCollaboration } from './pair-develop.collaboration';
import { ReviewChainCollaboration } from './review-chain.collaboration';
import { ClarificationLoopCollaboration } from './clarification-loop.collaboration';

/**
 * Executes an agent_collaboration node (Task 15): looks up the pattern named in
 * node.metadata.pattern and runs it. Each agent turn is a synthetic agent_task node run through
 * the engine (ctx.executeNode), so it is logged as its own workflow step and merges its output
 * into the run variables exactly like a normal agent node. Messages go through AgentMessageBus.
 *
 * Registers itself with the engine at module init, like QualityGateStrategy (Open/Closed).
 */
@Injectable()
export class AgentCollaborationStrategy implements NodeExecutionStrategy, OnModuleInit {
  readonly type = 'agent_collaboration' as const;
  readonly registry: CollaborationRegistry;

  constructor(
    private readonly engine: WorkflowEngine,
    private readonly bus: AgentMessageBus,
    @Inject(WORKFLOW_ENGINE_REPOSITORY) private readonly repository: IWorkflowEngineRepository
  ) {
    const clarification = new ClarificationLoopCollaboration();
    this.registry = new CollaborationRegistry([
      new PairDevelopCollaboration(clarification),
      new ReviewChainCollaboration(),
      clarification,
    ]);
  }

  onModuleInit(): void {
    this.engine.registerStrategy(this);
  }

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    const metadata = (node.metadata || {}) as Record<string, unknown>;
    const pattern = String(metadata.pattern || '');
    const conversationId = `${run.id}:${node.id}:${Date.now()}`;
    try {
      const strategy = this.registry.get(pattern);
      const vars = AgentCollaborationStrategy.variablesOf(run);
      const collaboration = this.contextFor(node, run, ctx, pattern, conversationId, metadata);

      ctx.logger.log(`Collaboration ${pattern} started on node ${node.id}`);
      const result = await strategy.run(collaboration);

      for (const [key, value] of Object.entries(result.output)) {
        if (key !== 'action') vars[key] = value;
      }
      await this.repository.updateRun(run.id, { context: run.context as any });

      return {
        status: 'success',
        output: { ...result.output, pattern, edgeCondition: result.edgeCondition || 'onSuccess' },
      };
    } catch (error) {
      ctx.logger.error(`Collaboration ${pattern || '(none)'} failed on node ${node.id}: ${(error as Error).message}`);
      return { status: 'failure', error: (error as Error).message };
    } finally {
      this.bus.endConversation(conversationId);
    }
  }

  /** The run's variables object, created if missing, shared with every turn (AgentTaskStrategy writes into it) */
  static variablesOf(run: WorkflowRunRecord): Record<string, unknown> {
    const context = (run.context && typeof run.context === 'object' ? run.context : {}) as Record<string, unknown>;
    run.context = context as any;
    if (!context.variables || typeof context.variables !== 'object') context.variables = {};
    return context.variables as Record<string, unknown>;
  }

  private contextFor(
    node: WorkflowNode,
    run: WorkflowRunRecord,
    ctx: NodeExecutionContext,
    pattern: string,
    conversationId: string,
    options: Record<string, unknown>
  ): CollaborationContext {
    let turns = 0;
    const bus = this.bus;
    return {
      projectId: run.projectId,
      conversationId,
      pattern,
      options,
      variables: () => AgentCollaborationStrategy.variablesOf(run),

      async turn(role: string, taskType: string, input: Record<string, unknown> = {}): Promise<TurnOutput> {
        Object.assign(AgentCollaborationStrategy.variablesOf(run), input);
        turns++;
        const turnNode: WorkflowNode = {
          id: `${node.id}:${turns}:${role.toLowerCase()}-${taskType}`,
          type: 'agent_task',
          agentRole: role as any,
          taskType,
          metadata: { promptTemplate: `${pattern}: ${taskType}`, collaboration: pattern, parentNodeId: node.id },
        };
        const result = await ctx.executeNode(turnNode, run);
        return AgentTaskStrategy.unwrapActionOutput((result.output as any)?.action) || {};
      },

      say(performative: Performative, sender: string, receiver: string, content: string, inReplyTo?: AclMessage): Promise<AclMessage> {
        return bus.send({
          performative,
          sender,
          receiver,
          content,
          projectId: run.projectId,
          conversationId,
          inReplyTo: inReplyTo?.id,
          protocol: pattern,
        });
      },
    };
  }
}
