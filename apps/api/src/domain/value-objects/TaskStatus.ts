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
    try {
      const normalized = value.toLowerCase().trim();
      if (!TaskStatus.VALID_STATUSES.includes(normalized as any)) {
        throw new Error(`Invalid task status: '${value}'. Valid values: ${TaskStatus.VALID_STATUSES.join(', ')}`);
      }
      return new TaskStatus(normalized);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid task status')) {
        throw error;
      }
      throw new Error(`Failed to create TaskStatus from value '${value}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Factory methods (using getters to guarantee immutability)
  static get TODO() { return new TaskStatus('todo'); }
  static get IN_PROGRESS() { return new TaskStatus('in_progress'); }
  static get REVIEW() { return new TaskStatus('review'); }
  static get DONE() { return new TaskStatus('done'); }

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
