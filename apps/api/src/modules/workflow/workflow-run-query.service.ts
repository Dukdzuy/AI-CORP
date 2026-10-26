import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowDefinition } from '@ai-corp/shared-types';
import {
  IWorkflowEngineRepository,
  WORKFLOW_ENGINE_REPOSITORY,
  WorkflowRunRecord,
  WorkflowStepRecord,
} from './persistence/workflow-engine.repository';
import { WorkflowEngine } from './workflow.engine';

export interface WorkflowRunTree {
  run: Omit<WorkflowRunRecord, 'context'>;
  definition: Pick<WorkflowDefinition, 'id' | 'name' | 'version' | 'startNode' | 'endNode' | 'nodes' | 'edges'> | null;
  steps: WorkflowStepRecord[];
  /** Sub-workflow runs started by this run's sub_workflow nodes, oldest first */
  children: WorkflowRunTree[];
}

/**
 * Read side of the workflow module: a run with its steps and the hierarchy of sub-workflow runs
 * (Task 16), for the nested view and the execution timeline in the UI.
 */
@Injectable()
export class WorkflowRunQueryService {
  private static readonly MAX_DEPTH = 6;

  constructor(
    @Inject(WORKFLOW_ENGINE_REPOSITORY) private readonly repository: IWorkflowEngineRepository,
    private readonly engine: WorkflowEngine
  ) {}

  async getRunTree(runId: string): Promise<WorkflowRunTree> {
    const run = await this.repository.findRunById(runId);
    if (!run) throw new NotFoundException(`Workflow run ${runId} not found`);
    return this.build(run, 0);
  }

  private async build(run: WorkflowRunRecord, depth: number): Promise<WorkflowRunTree> {
    const [steps, childRuns] = await Promise.all([
      this.repository.findStepsByRun(run.id),
      depth < WorkflowRunQueryService.MAX_DEPTH ? this.repository.findChildRuns(run.id) : Promise.resolve([]),
    ]);
    const def = this.engine.definitionOf(run);
    const { context: _context, ...summary } = run;
    return {
      run: summary,
      definition: def
        ? { id: def.id, name: def.name, version: def.version, startNode: def.startNode, endNode: def.endNode, nodes: def.nodes, edges: def.edges }
        : null,
      steps,
      children: await Promise.all(childRuns.map(child => this.build(child, depth + 1))),
    };
  }
}
