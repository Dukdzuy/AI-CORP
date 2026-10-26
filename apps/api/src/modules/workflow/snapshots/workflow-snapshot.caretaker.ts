import { WorkflowSnapshotSummary } from '@ai-corp/shared-types';
import { WorkflowRunMemento } from '../../../domain/workflow/WorkflowRunMemento';
import { IWorkflowEngineRepository, WorkflowRunRecord } from '../persistence/workflow-engine.repository';

/** Which snapshot to roll back to: an explicit one, or N steps back from the latest (1 = re-run the last node) */
export type RollbackTarget = { snapshotId: string } | { steps: number };

/**
 * Caretaker of workflow run mementos (Task 17): stores them through the engine repository so
 * they survive restarts, and picks the one a rollback targets. It never interprets the context.
 *
 * @pattern Memento (caretaker)
 */
export class WorkflowSnapshotCaretaker {
  constructor(private readonly repository: IWorkflowEngineRepository) {}

  /** Snapshot a top-level run before its current node runs */
  async capture(run: WorkflowRunRecord): Promise<WorkflowRunMemento | null> {
    if (run.parentRunId || !run.currentNodeId) return null;
    const existing = await this.repository.findSnapshots(run.id);
    const sequence = existing.reduce((max, s) => Math.max(max, s.sequence), 0) + 1;
    const memento = WorkflowRunMemento.capture(run, sequence);
    await this.repository.createSnapshot(memento.toPrimitives());
    return memento;
  }

  async list(runId: string): Promise<WorkflowSnapshotSummary[]> {
    const records = await this.repository.findSnapshots(runId);
    return records.map(r => ({
      id: r.id,
      workflowRunId: r.workflowRunId,
      sequence: r.sequence,
      nodeId: r.nodeId,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async select(runId: string, target: RollbackTarget): Promise<WorkflowRunMemento> {
    const records = await this.repository.findSnapshots(runId);
    if (records.length === 0) throw new Error(`Run ${runId} has no snapshots to roll back to`);

    let record;
    if ('snapshotId' in target) {
      record = records.find(r => r.id === target.snapshotId);
      if (!record) throw new Error(`Snapshot ${target.snapshotId} does not belong to run ${runId}`);
    } else {
      const steps = target.steps;
      if (!Number.isInteger(steps) || steps < 1) throw new Error('steps must be a positive integer');
      if (steps > records.length) {
        throw new Error(`Cannot roll back ${steps} steps: run ${runId} has only ${records.length} snapshot(s)`);
      }
      record = records[records.length - steps];
    }
    return WorkflowRunMemento.fromPrimitives(record);
  }

  /** Forget the target snapshot and everything after it (the node re-runs and is snapshotted again) */
  async discardFrom(runId: string, sequence: number): Promise<void> {
    await this.repository.deleteSnapshotsAfter(runId, sequence - 1);
  }
}
