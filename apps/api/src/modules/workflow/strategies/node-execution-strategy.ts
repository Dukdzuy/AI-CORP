import { Logger } from '@nestjs/common';
import { NodeType, NodeResult, WorkflowDefinition, WorkflowNode } from '@ai-corp/shared-types';
import { WorkflowRunRecord } from '../persistence/workflow-engine.repository';

/**
 * What the engine hands a strategy when it runs a node.
 * Lets strategies reach engine-owned state without depending on the engine class.
 */
export interface NodeExecutionContext {
  logger: Logger;
  getDefinition(workflowDefId: string, version?: string | null): WorkflowDefinition | undefined;
  /** The definition (pinned version) a run executes */
  definitionOf(run: WorkflowRunRecord): WorkflowDefinition | undefined;
  /** Runs another node through the engine's full step lifecycle (used by parallel nodes). */
  executeNode(node: WorkflowNode, run: WorkflowRunRecord): Promise<NodeResult>;
}

/**
 * Strategy pattern: one implementation per workflow node type.
 * The engine looks the strategy up by `type` instead of switching on node.type.
 */
export interface NodeExecutionStrategy {
  readonly type: NodeType;
  execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult>;
}
