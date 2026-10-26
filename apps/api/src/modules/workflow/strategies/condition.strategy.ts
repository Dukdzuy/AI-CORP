import { WorkflowNode, NodeResult, WorkflowContext, WorkflowStateChangedEvent } from '@ai-corp/shared-types';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { NodeExecutionStrategy, NodeExecutionContext } from './node-execution-strategy';

/**
 * Execute a condition node - evaluates conditions from context
 * Implements Requirement 2: DAG-based workflow with conditional branching
 * Implements Requirement 9: WebSocket events for state changes
 */
export class ConditionStrategy implements NodeExecutionStrategy {
  readonly type = 'condition' as const;

  constructor(private readonly websocketGateway: AppWebSocketGateway) {}

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    ctx.logger.log(`Evaluating condition node ${node.id}`);

    // Simple condition evaluation (can be extended with a proper expression evaluator)
    const context = run.context as WorkflowContext;
    let conditionResult = false;

    try {
      // Example: Check if a variable in context meets condition
      // This is a simplified implementation - production should use a safe expression evaluator
      const variable = (node.metadata as any)?.variable;
      const operator = (node.metadata as any)?.operator;
      const value = (node.metadata as any)?.value;

      if (!variable || !operator) {
        throw new Error(`Condition node ${node.id} missing required metadata: variable, operator`);
      }

      const contextValue = context.variables[variable];

      ctx.logger.log(`Evaluating condition: ${variable} ${operator} ${value}, context value: ${contextValue}`);

      switch (operator) {
        case 'equals':
          conditionResult = contextValue === value;
          break;
        case 'not_equals':
          conditionResult = contextValue !== value;
          break;
        case 'greater_than':
          conditionResult = Number(contextValue) > Number(value);
          break;
        case 'less_than':
          conditionResult = Number(contextValue) < Number(value);
          break;
        case 'exists':
          conditionResult = contextValue !== undefined && contextValue !== null;
          break;
        case 'not_exists':
          conditionResult = contextValue === undefined || contextValue === null;
          break;
        default:
          throw new Error(`Unknown operator: ${operator}`);
      }

      ctx.logger.log(`Condition evaluated to: ${conditionResult}`);

      // Emit condition evaluation event (Req 9)
      this.websocketGateway.sendToProject(run.projectId, {
        type: 'workflow:state_changed',
        data: {
          workflowRunId: run.id,
          projectId: run.projectId,
          previousState: 'running',
          currentState: 'condition_evaluated',
          currentNodeId: node.id,
          timestamp: new Date()
        } as WorkflowStateChangedEvent,
        timestamp: new Date()
      });

      return {
        status: 'success',
        output: {
          conditionResult,
          edgeCondition: conditionResult ? 'onSuccess' : 'onFail',
          variable,
          operator,
          value,
          contextValue
        }
      };
    } catch (error) {
      ctx.logger.error(`Error evaluating condition for node ${node.id}: ${(error as Error).message}`);
      return {
        status: 'failure',
        error: (error as Error).message
      };
    }
  }
}
