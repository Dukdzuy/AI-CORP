import { Injectable, OnModuleInit } from '@nestjs/common';
import { WorkflowNode, NodeResult } from '@ai-corp/shared-types';
import { WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { NodeExecutionStrategy, NodeExecutionContext } from './node-execution-strategy';
import { DEFAULT_OOAD_GATE_CRITERIA, QualityGateCriteria, QualityGateHandler } from '../handlers/quality-gate.handler';
import { WorkflowEngine } from '../workflow.engine';

/**
 * Execute a quality_gate node: checks the OOAD artifacts of the project (counts in ooadMetadata
 * and rendered files in the workspace) before implementation may start.
 * Passed → edge 'onSuccess'; failed → edge 'onFail' (the default workflow loops back to the Architect).
 *
 * Registers itself with the engine at module init, so the engine needs no change for this node type
 * (Open/Closed Principle).
 */
@Injectable()
export class QualityGateStrategy implements NodeExecutionStrategy, OnModuleInit {
  readonly type = 'quality_gate' as const;

  constructor(
    private readonly engine: WorkflowEngine,
    private readonly handler: QualityGateHandler
  ) {}

  onModuleInit(): void {
    this.engine.registerStrategy(this);
  }

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    const criteria: QualityGateCriteria = {
      ...DEFAULT_OOAD_GATE_CRITERIA,
      ...((node.metadata?.criteria as Partial<QualityGateCriteria>) || {}),
    };
    const result = await this.handler.executeGate(run.projectId, node.id, criteria);
    ctx.logger.log(`Quality gate ${node.id}: ${result.passed ? 'passed' : 'failed'} (${result.score}%)`);

    return {
      status: 'success',
      output: {
        ...result,
        edgeCondition: result.passed ? 'onSuccess' : 'onFail',
      },
    };
  }
}
