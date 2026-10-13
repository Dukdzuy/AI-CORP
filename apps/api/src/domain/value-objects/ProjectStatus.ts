/**
 * ProjectStatus Value Object
 * 
 * Enum-like value object representing project lifecycle status.
 * Based on Prisma schema: active, paused, completed, cancelled
 * 
 * Enforces valid state transitions:
 * - active -> paused, completed, cancelled
 * - paused -> active, cancelled
 * - completed/cancelled -> terminal states (no transitions)
 * 
 * @pattern Value Object, State Pattern
 * @principle Business Rule Enforcement
 */

export class ProjectStatus {
  private static readonly VALID_STATUSES = ['active', 'paused', 'completed', 'cancelled'] as const;
  
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    'active': ['paused', 'completed', 'cancelled'],
    'paused': ['active', 'cancelled'],
    'completed': [], // Terminal state
    'cancelled': []  // Terminal state
  };

  private constructor(private readonly value: string) {
    if (!ProjectStatus.VALID_STATUSES.includes(value as any)) {
      throw new Error(`Invalid project status: ${value}`);
    }
  }

  static fromString(value: string): ProjectStatus {
    return new ProjectStatus(value.toLowerCase());
  }

  // Factory methods
  static ACTIVE = new ProjectStatus('active');
  static PAUSED = new ProjectStatus('paused');
  static COMPLETED = new ProjectStatus('completed');
  static CANCELLED = new ProjectStatus('cancelled');

  canTransitionTo(target: ProjectStatus): boolean {
    const allowed = ProjectStatus.VALID_TRANSITIONS[this.value] || [];
    return allowed.includes(target.value);
  }

  isTerminal(): boolean {
    return this.value === 'completed' || this.value === 'cancelled';
  }

  isActive(): boolean {
    return this.value === 'active';
  }

  toString(): string {
    return this.value;
  }

  equals(other: ProjectStatus): boolean {
    return this.value === other.value;
  }
}
