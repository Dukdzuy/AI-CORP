/**
 * Memento of a workflow run (Task 17): the state needed to put a run back where it was before a
 * node executed. The engine is the originator (creates and restores mementos), the snapshot
 * service is the caretaker (stores them, never looks inside the context).
 *
 * The context is deep-copied on the way in and on the way out, so a memento can't be changed
 * through the run it was taken from or the run it is restored into.
 *
 * Generated files in the project workspace are not part of the memento: a rolled-back run
 * re-runs the agents, which rewrite their files.
 *
 * @pattern Memento
 */
export class WorkflowRunMemento {
  private constructor(
    readonly runId: string,
    readonly sequence: number,
    readonly nodeId: string,
    readonly status: string,
    private readonly contextJson: string,
    readonly createdAt: Date
  ) {}

  static capture(
    run: { id: string; currentNodeId: string | null; status: string; context: unknown },
    sequence: number,
    at: Date = new Date()
  ): WorkflowRunMemento {
    if (!run.currentNodeId) throw new Error(`Run ${run.id} has no current node to snapshot`);
    return new WorkflowRunMemento(run.id, sequence, run.currentNodeId, run.status, JSON.stringify(run.context ?? {}), at);
  }

  static fromPrimitives(state: {
    workflowRunId: string;
    sequence: number;
    nodeId: string;
    status: string;
    context: unknown;
    createdAt: Date;
  }): WorkflowRunMemento {
    return new WorkflowRunMemento(
      state.workflowRunId,
      state.sequence,
      state.nodeId,
      state.status,
      JSON.stringify(state.context ?? {}),
      state.createdAt
    );
  }

  /** A fresh copy of the context the run had when the memento was taken */
  context(): Record<string, unknown> {
    return JSON.parse(this.contextJson);
  }

  toPrimitives() {
    return {
      workflowRunId: this.runId,
      sequence: this.sequence,
      nodeId: this.nodeId,
      status: this.status,
      context: this.context(),
      createdAt: this.createdAt,
    };
  }
}
