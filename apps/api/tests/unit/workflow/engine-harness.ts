import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NodeResult, WorkflowDefinition } from '@ai-corp/shared-types';
import { WorkflowEngine } from '../../../src/modules/workflow/workflow.engine';
import { SubWorkflowStrategy } from '../../../src/modules/workflow/strategies/sub-workflow.strategy';
import {
  CreateApprovalInput,
  CreateRunInput,
  CreateSnapshotInput,
  CreateStepInput,
  IWorkflowEngineRepository,
  UpdateRunInput,
  UpdateStepInput,
  WorkflowRunRecord,
  WorkflowSnapshotRecord,
  WorkflowStepRecord,
} from '../../../src/modules/workflow/persistence/workflow-engine.repository';

/**
 * In-memory IWorkflowEngineRepository: the engine's whole persistence port, so the real engine,
 * strategies and snapshot caretaker run end to end without a database. Records are deep-copied
 * on the way in and out, like rows in a database.
 */
export class InMemoryWorkflowEngineRepository implements IWorkflowEngineRepository {
  runs = new Map<string, WorkflowRunRecord>();
  steps: (WorkflowStepRecord & { output?: string })[] = [];
  snapshots: WorkflowSnapshotRecord[] = [];
  approvals: { id: string; workflowRunId: string; status: string }[] = [];

  private static copy<T>(value: T): T {
    return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value), (_k, v) =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v
    );
  }

  async createRun(data: CreateRunInput) {
    const run: WorkflowRunRecord = {
      id: randomUUID(),
      projectId: data.projectId,
      workflowDefId: data.workflowDefId,
      workflowDefVersion: data.workflowDefVersion ?? null,
      parentRunId: data.parentRunId ?? null,
      parentNodeId: data.parentNodeId ?? null,
      status: data.status,
      currentNodeId: data.currentNodeId,
      context: InMemoryWorkflowEngineRepository.copy(data.context),
      startedAt: new Date(),
      completedAt: null,
    };
    this.runs.set(run.id, run);
    return InMemoryWorkflowEngineRepository.copy(run);
  }
  async findRunById(runId: string) {
    return InMemoryWorkflowEngineRepository.copy(this.runs.get(runId) || null);
  }
  async findRunsByStatus(status: string) {
    return [...this.runs.values()].filter(r => r.status === status && !r.parentRunId).map(r => InMemoryWorkflowEngineRepository.copy(r));
  }
  async findChildRuns(parentRunId: string) {
    return [...this.runs.values()].filter(r => r.parentRunId === parentRunId).map(r => InMemoryWorkflowEngineRepository.copy(r));
  }
  async updateRun(runId: string, data: UpdateRunInput) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    Object.assign(run, InMemoryWorkflowEngineRepository.copy(data));
    return InMemoryWorkflowEngineRepository.copy(run);
  }
  async createStep(data: CreateStepInput) {
    const step = { id: randomUUID(), ...data, completedAt: null, durationMs: null, error: null } as WorkflowStepRecord;
    this.steps.push(step);
    return { ...step };
  }
  async updateStep(stepId: string, data: UpdateStepInput) {
    const step = this.steps.find(s => s.id === stepId)!;
    Object.assign(step, data);
    return { ...step };
  }
  async failRunningSteps(runId: string, error: string) {
    const running = this.steps.filter(s => s.workflowRunId === runId && s.status === 'running');
    running.forEach(s => Object.assign(s, { status: 'failed', error, completedAt: new Date() }));
    return running.length;
  }
  async findStepsByRun(runId: string) {
    return this.steps.filter(s => s.workflowRunId === runId).map(s => ({ ...s }));
  }
  async createSnapshot(data: CreateSnapshotInput) {
    if (this.snapshots.some(s => s.workflowRunId === data.workflowRunId && s.sequence === data.sequence)) {
      throw new Error('unique constraint (workflowRunId, sequence)');
    }
    const snapshot = { id: randomUUID(), ...InMemoryWorkflowEngineRepository.copy(data) };
    this.snapshots.push(snapshot);
    return InMemoryWorkflowEngineRepository.copy(snapshot);
  }
  async findSnapshots(runId: string) {
    return this.snapshots
      .filter(s => s.workflowRunId === runId)
      .sort((a, b) => a.sequence - b.sequence)
      .map(s => InMemoryWorkflowEngineRepository.copy(s));
  }
  async deleteSnapshotsAfter(runId: string, sequence: number) {
    this.snapshots = this.snapshots.filter(s => !(s.workflowRunId === runId && s.sequence > sequence));
  }
  async findProjectWithOwner(projectId: string) {
    return { id: projectId, createdById: 'owner-1' };
  }
  projectStatus = 'active';
  budget: number | null = null;
  costAccrued = 0;
  async updateProjectStatus(_projectId: string, status: string) {
    this.projectStatus = status;
    return undefined;
  }
  async completeProject() {
    if (this.projectStatus !== 'cancelled') this.projectStatus = 'completed';
    return undefined;
  }
  async findProjectBudget() {
    return { status: this.projectStatus, budget: this.budget, costAccrued: this.costAccrued };
  }
  async findLatestRun(projectId: string) {
    const runs = [...this.runs.values()].filter(r => r.projectId === projectId && !r.parentRunId);
    return InMemoryWorkflowEngineRepository.copy(runs[runs.length - 1] || null);
  }
  async createApproval(data: CreateApprovalInput) {
    const approval = { id: randomUUID(), workflowRunId: data.workflowRunId, status: data.status };
    this.approvals.push(approval);
    return { id: approval.id };
  }
  async countPendingApprovals(runId: string) {
    return this.approvals.filter(a => a.workflowRunId === runId && a.status === 'pending').length;
  }
  async cancelPendingApprovals(runId: string) {
    const pending = this.approvals.filter(a => a.workflowRunId === runId && a.status === 'pending');
    pending.forEach(a => (a.status = 'cancelled'));
    return pending.length;
  }
}

export type AgentScript = (role: string, input: Record<string, any>) => Promise<Record<string, unknown>> | Record<string, unknown>;

/**
 * A real WorkflowEngine over the in-memory repository, with scripted agents.
 * BullMQ must be mocked by the spec (jest.mock('bullmq')) so the engine runs nodes directly.
 */
export function createEngine(script: AgentScript, repository = new InMemoryWorkflowEngineRepository()) {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  const calls: { role: string; taskType?: string; at: number; input: Record<string, any> }[] = [];
  const orchestrator = {
    invokeAgent: jest.fn(async (role: string, input: Record<string, any>) => {
      calls.push({ role, taskType: input.taskType, at: Date.now(), input });
      const output = await script(role, input);
      return { action: { success: true, output } };
    }),
  };
  const websocket = { sendToProject: jest.fn(), sendToProjectAndUser: jest.fn(), sendToUser: jest.fn() };
  const taskRepository = { findByStatus: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const engine = new WorkflowEngine(
    repository,
    websocket as any,
    orchestrator as any,
    events as any,
    { create: jest.fn() } as any,
    taskRepository as any
  );
  // Sub-workflow nodes are registered by the Nest module at init; do the same here
  const subWorkflows = new SubWorkflowStrategy(engine, repository, websocket as any);
  subWorkflows.onModuleInit();
  return { engine, repository, orchestrator, websocket, calls, events };
}

/** Wait until the run reaches one of the statuses (the engine runs nodes in the background) */
export async function waitForStatus(
  repository: InMemoryWorkflowEngineRepository,
  runId: string,
  statuses: string[],
  timeoutMs = 5000
): Promise<WorkflowRunRecord> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const run = await repository.findRunById(runId);
    if (run && statuses.includes(run.status)) return run;
    if (Date.now() > deadline) throw new Error(`Run ${runId} is ${run?.status} at ${run?.currentNodeId}, expected ${statuses.join('/')}`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

export function agentNode(id: string, role: string, taskType = id, extra: Record<string, unknown> = {}) {
  return { id, type: 'agent_task' as const, agentRole: role as any, taskType, maxRetries: 0, ...extra };
}

export function linear(id: string, nodes: any[], extraEdges: any[] = [], version = '1.0.0'): WorkflowDefinition {
  return {
    id,
    name: id,
    version,
    startNode: nodes[0].id,
    endNode: nodes[nodes.length - 1].id,
    nodes,
    edges: [
      ...nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
      ...extraEdges,
    ],
  };
}

export type { NodeResult };
