/**
 * TaskStatus Value Object
 * 
 * Enum-like value object representing Kanban task status.
 * Based on Prisma schema: todo, in_progress, review, done
 * 
 * Enforces valid state transitions (Requirement 12):
 * - todo -> in_progress, done
 * - in_progress -> review, todo (back to backlog)
 * - review -> done, in_progress (needs rework)
 * - done -> terminal state
 * 
 * @pattern Value Object, State Pattern
 * @principle Kanban Workflow Rules
 */

export class TaskStatus {
  private static readonly VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
  
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    'todo': ['in_progress', 'done'],
    'in_progress': ['review', 'todo'],
    'review': ['done', 'in_progress'],
    'done': [] // Terminal state
  };

  private constructor(private readonly value: string) {
    if (!TaskStatus.VALID_STATUSES.includes(value as any)) {
      throw new Error(`Invalid task status: ${value}`);
    }
  }

  static fromString(value: string): TaskStatus {
    return new TaskStatus(value.toLowerCase());
  }

  // Factory methods
  static TODO = new TaskStatus('todo');
  static IN_PROGRESS = new TaskStatus('in_progress');
  static REVIEW = new TaskStatus('review');
  static DONE = new TaskStatus('done');

  canTransitionTo(target: TaskStatus): boolean {
    const allowed = TaskStatus.VALID_TRANSITIONS[this.value] || [];
    return allowed.includes(target.value);
  }

  requiresReview(): boolean {
    return this.value === 'review';
  }

  isComplete(): boolean {
    return this.value === 'done';
  }

  toString(): string {
    return this.value;
  }

  equals(other: TaskStatus): boolean {
    return this.value === other.value;
  }
}
