/**
 * Port used by the workflow when the PM agent creates its tasks (Phase 6, Task 25).
 * The estimation module implements it; without it tasks are created without an estimate.
 *
 * @pattern Port (Hexagonal Architecture), Dependency Inversion
 */
export const TASK_COST_ESTIMATOR = Symbol('TASK_COST_ESTIMATOR');

export interface ITaskCostEstimator {
  /** Estimated LLM cost of implementing and verifying one of `taskCount` planned tasks, or null */
  estimateTaskCost(projectId: string, taskCount: number): Promise<number | null>;
}
