/**
 * Phase 6 / Task 27: unit tests of the core domain model (entities, value objects,
 * exceptions, event facade). These rules guard every project, task and milestone the
 * agents create, so the domain layer carries the strictest coverage threshold.
 */
import { Milestone, Project, Task } from '../../../src/domain/entities';
import { AgentRole, Money, ProjectStatus, TaskStatus } from '../../../src/domain/value-objects';
import {
  DatabaseConnectionException,
  DomainException,
  EntityNotFoundException,
  ForeignKeyViolationException,
  RepositoryException,
  UniqueConstraintViolationException,
} from '../../../src/domain/exceptions';
import { DomainEvents } from '../../../src/domain/events/DomainEvents';
import { EventBus } from '../../../src/domain/events/EventBus';
import { WorkflowPausedEvent } from '../../../src/domain/events';
import { AccessDeniedError } from '../../../src/domain/security';

const GOAL = 'Build an online shop with orders and payments';
const DAY = 86_400_000;

describe('Money', () => {
  it('is an immutable non-negative amount with arithmetic and comparisons', () => {
    const a = Money.dollars(10);
    const b = Money.dollars(4);
    expect(a.add(b).toNumber()).toBe(14);
    expect(a.subtract(b).toNumber()).toBe(6);
    expect(a.multiply(1.5).toNumber()).toBe(15);
    expect(a.toNumber()).toBe(10);
    expect(a.greaterThan(b) && a.greaterThanOrEqual(a) && b.lessThan(a) && b.lessThanOrEqual(b)).toBe(true);
    expect(a.equals(Money.dollars(10))).toBe(true);
    expect(Money.zero().toString()).toBe('$0.00');
    expect(Money.dollars(1.005).toString()).toBe('$1.00');
  });

  it('rejects negative, infinite and negative-factor amounts', () => {
    expect(() => Money.dollars(-1)).toThrow('cannot be negative');
    expect(() => Money.dollars(Infinity)).toThrow('finite');
    expect(() => Money.dollars(1).subtract(Money.dollars(2))).toThrow('cannot be negative');
    expect(() => Money.dollars(1).multiply(-1)).toThrow('negative factor');
  });
});

describe('AgentRole', () => {
  it('knows the 8 roles and groups them', () => {
    expect(AgentRole.fromString('dev').equals(AgentRole.DEV)).toBe(true);
    expect(AgentRole.QC.toString()).toBe('QC');
    expect(AgentRole.ARCHITECT.isTechnical()).toBe(true);
    expect(AgentRole.MARKETING.isTechnical()).toBe(false);
    expect(AgentRole.BA.isManagement()).toBe(true);
    expect(AgentRole.QA.isManagement()).toBe(false);
    expect([AgentRole.CEO, AgentRole.PM].every(r => r.isManagement())).toBe(true);
    expect(() => AgentRole.fromString('devops')).toThrow('Invalid agent role: DEVOPS');
  });
});

describe('ProjectStatus and TaskStatus', () => {
  it('ProjectStatus: parsing, transitions and terminal states', () => {
    expect(ProjectStatus.fromString(' Active ').equals(ProjectStatus.ACTIVE)).toBe(true);
    expect(() => ProjectStatus.fromString('done')).toThrow("Invalid project status: 'done'");
    expect(ProjectStatus.ACTIVE.canTransitionTo(ProjectStatus.PAUSED)).toBe(true);
    expect(ProjectStatus.PAUSED.canTransitionTo(ProjectStatus.COMPLETED)).toBe(false);
    expect(ProjectStatus.COMPLETED.canTransitionTo(ProjectStatus.ACTIVE)).toBe(false);
    expect(ProjectStatus.CANCELLED.isTerminal()).toBe(true);
    expect(ProjectStatus.PAUSED.isActive()).toBe(false);
    expect(ProjectStatus.PAUSED.toString()).toBe('paused');
    expect(() => ProjectStatus.fromString(null as any)).toThrow('Failed to create ProjectStatus');
  });

  it('TaskStatus: Kanban transitions', () => {
    expect(TaskStatus.fromString('IN_PROGRESS').equals(TaskStatus.IN_PROGRESS)).toBe(true);
    expect(() => TaskStatus.fromString('blocked')).toThrow("Invalid task status: 'blocked'");
    expect(() => TaskStatus.fromString(undefined as any)).toThrow('Failed to create TaskStatus');
    expect(TaskStatus.TODO.canTransitionTo(TaskStatus.REVIEW)).toBe(false);
    expect(TaskStatus.REVIEW.canTransitionTo(TaskStatus.DONE)).toBe(true);
    expect(TaskStatus.DONE.canTransitionTo(TaskStatus.TODO)).toBe(false);
    expect(TaskStatus.REVIEW.requiresReview()).toBe(true);
    expect(TaskStatus.DONE.isComplete()).toBe(true);
    expect(TaskStatus.DONE.toString()).toBe('done');
  });
});

describe('Project entity', () => {
  const create = (budget?: number) => Project.create({ name: ' Shop ', description: ' d ', goal: GOAL, createdById: 'u1', budget: budget !== undefined ? Money.dollars(budget) : undefined });

  it('validates name, goal and budget on creation and starts active', () => {
    const p = create(100);
    expect(p.toPrimitives()).toMatchObject({ name: 'Shop', description: 'd', goal: GOAL, status: 'active', budget: 100, costAccrued: 0, createdById: 'u1' });
    expect(p.getId()).toMatch(/[0-9a-f-]{36}/);
    expect(() => Project.create({ name: 'AB', description: '', goal: GOAL, createdById: 'u' })).toThrow('at least 3 characters');
    expect(() => Project.create({ name: 'Shop', description: '', goal: 'short', createdById: 'u' })).toThrow('at least 20 characters');
    expect(() => create(0)).toThrow('Budget must be positive');
    expect(create().getRemainingBudget()).toBeNull();
    expect(create().getBudgetUtilizationPercent()).toBeNull();
  });

  it('accrues cost and pauses itself when the budget is reached', () => {
    const p = create(10);
    p.accrueCost(Money.dollars(4));
    expect(p.getRemainingBudget()!.toNumber()).toBe(6);
    expect(p.getBudgetUtilizationPercent()).toBe(40);
    expect(p.isBudgetExceeded()).toBe(false);
    p.accrueCost(Money.dollars(7));
    expect(p.isBudgetExceeded()).toBe(true);
    expect(p.isOverBudget()).toBe(true);
    expect(p.getRemainingBudget()!.toNumber()).toBe(0);
    expect(p.getStatus().toString()).toBe('paused');
    expect(create().isBudgetExceeded()).toBe(false);
    expect(create().isOverBudget()).toBe(false);
  });

  it('follows the status state machine', () => {
    const p = create();
    p.transitionTo(ProjectStatus.ACTIVE); // no-op
    p.transitionTo(ProjectStatus.PAUSED);
    expect(() => p.complete()).toThrow('Cannot transition from paused to completed');
    p.transitionTo(ProjectStatus.ACTIVE);
    p.transitionTo(ProjectStatus.COMPLETED);
    expect(() => p.pause()).toThrow('Cannot pause completed project');
    expect(() => p.resume()).toThrow('Can only resume paused projects');
    expect(() => p.cancel()).toThrow('Cannot transition from completed to cancelled');

    const q = create();
    q.transitionTo(ProjectStatus.CANCELLED);
    expect(q.getStatus().isTerminal()).toBe(true);
    const r = create();
    r.cancel();
    expect(() => Project.fromPrimitives({ ...r.toPrimitives(), status: 'cancelled' }).transitionTo(ProjectStatus.PAUSED)).toThrow('Cannot pause cancelled project');
  });

  it('updates details and budget with the same rules, and round-trips through primitives', () => {
    const p = create(50);
    p.updateDetails(' New name ', ' new desc ', ` ${GOAL} v2 `);
    expect(p.getName()).toBe('New name');
    expect(p.getDescription()).toBe('new desc');
    expect(p.getGoal()).toBe(`${GOAL} v2`);
    expect(() => p.updateDetails('x')).toThrow('at least 3');
    expect(() => p.updateDetails(undefined, undefined, 'short')).toThrow('at least 20');
    p.updateBudget(null);
    expect(p.getBudget()).toBeNull();
    expect(() => p.updateBudget(Money.zero())).toThrow('positive');

    const copy = Project.fromPrimitives(p.toPrimitives());
    expect(copy.toPrimitives()).toEqual(p.toPrimitives());
    expect(copy.getCostAccrued().toNumber()).toBe(0);
    expect(copy.getCreatedById()).toBe('u1');
    expect(copy.getCreatedAt()).toBeInstanceOf(Date);
    expect(copy.getUpdatedAt()).toBeInstanceOf(Date);
    expect(Project.fromPrimitives({ ...p.toPrimitives(), budget: 20 }).getBudget()!.toNumber()).toBe(20);
  });
});

describe('Task entity', () => {
  const create = (estimate?: number) => Task.create({ projectId: 'p1', title: ' UC-001 Place order ', description: ' d ', estimatedCost: estimate !== undefined ? Money.dollars(estimate) : undefined });

  it('starts in TODO with defaults and validates the title', () => {
    const t = create();
    expect(t.toPrimitives()).toMatchObject({ projectId: 'p1', title: 'UC-001 Place order', description: 'd', status: 'todo', priority: 'medium', assignedAgent: null, estimatedCost: null, actualCost: 0, milestoneId: null });
    expect(() => Task.create({ projectId: 'p', title: '  ', description: '' })).toThrow('must not be empty');
  });

  it('moves through the Kanban board, including review rejections', () => {
    const t = create();
    t.transitionTo(TaskStatus.IN_PROGRESS);
    t.transitionTo(TaskStatus.REVIEW);
    t.transitionTo(TaskStatus.IN_PROGRESS, 'needs tests'); // reject
    expect(t.getStatus().toString()).toBe('in_progress');
    t.transitionTo(TaskStatus.TODO);
    t.transitionTo(TaskStatus.DONE); // complete straight from todo
    expect(t.getStatus().isComplete()).toBe(true);
    t.transitionTo(TaskStatus.DONE); // no-op

    const r = create();
    r.startProgress();
    r.submitForReview();
    r.transitionTo(TaskStatus.DONE); // approve
    expect(r.getStatus().toString()).toBe('done');

    const bad = create();
    expect(() => bad.submitForReview()).toThrow('Cannot transition from todo to review');
    expect(() => bad.approve()).toThrow('Can only approve tasks in review');
    expect(() => bad.reject('x')).toThrow('Can only reject tasks in review');
    bad.complete();
    expect(() => bad.startProgress()).toThrow('Cannot transition from done to in_progress');
    expect(() => bad.complete()).toThrow('Cannot transition from done to done');
    expect(() => bad.moveBackToBacklog()).toThrow('Cannot transition from done to todo');
  });

  it('tracks actual cost against the estimate', () => {
    const t = create(2);
    expect(t.getCostVariance()).toBe(-2); // under the estimate (threw before Phase 6)
    t.accrueCost(Money.dollars(3));
    expect(t.isOverEstimate()).toBe(true);
    expect(t.getCostVariance()).toBe(1);
    expect(create().isOverEstimate()).toBe(false);
    expect(create().getCostVariance()).toBeNull();
  });

  it('updates details, assignment, priority, estimate and milestone, and round-trips through primitives', () => {
    const t = create();
    t.updateDetails(' New ', ' desc ');
    expect(() => t.updateDetails(' ')).toThrow('must not be empty');
    t.assignTo('DEV');
    t.updatePriority('high');
    t.updateEstimate(Money.dollars(0.5));
    t.associateWithMilestone('m1');
    expect([t.getTitle(), t.getDescription(), t.getAssignedAgent(), t.getPriority(), t.getEstimatedCost()!.toNumber(), t.getMilestoneId()]).toEqual(['New', 'desc', 'DEV', 'high', 0.5, 'm1']);
    const copy = Task.fromPrimitives(t.toPrimitives());
    expect(copy.toPrimitives()).toEqual(t.toPrimitives());
    expect([copy.getId(), copy.getProjectId(), copy.getActualCost().toNumber()]).toEqual([t.getId(), 'p1', 0]);
    expect(copy.getCreatedAt()).toBeInstanceOf(Date);
    expect(copy.getUpdatedAt()).toBeInstanceOf(Date);
    expect(Task.fromPrimitives({ ...t.toPrimitives(), estimatedCost: null }).getEstimatedCost()).toBeNull();
  });
});

describe('Milestone entity', () => {
  const future = (days: number) => new Date(Date.now() + days * DAY);
  const create = (dueDate?: Date | null) => Milestone.create({ projectId: 'p1', name: ' MVP ', description: ' first ', dueDate });

  it('validates the name and a future due date', () => {
    expect(create().toPrimitives()).toMatchObject({ name: 'MVP', description: 'first', status: 'pending', dueDate: null });
    expect(() => Milestone.create({ projectId: 'p', name: '', description: '' })).toThrow('must not be empty');
    expect(() => create(new Date(Date.now() - DAY))).toThrow('Due date must be in the future');
  });

  it('pending → in progress → completed, with the overdue guard', () => {
    const m = create(future(30));
    m.transitionTo('pending'); // no-op
    m.transitionTo('in_progress');
    expect(() => m.start()).toThrow('Can only start pending');
    m.transitionTo('pending');
    m.transitionTo('completed');
    expect(() => m.complete()).toThrow('already completed');
    expect(() => m.moveBackToPending()).toThrow('Cannot move completed');
    expect(() => create().transitionTo('archived')).toThrow("Invalid milestone status: 'archived'");

    const overdue = Milestone.fromPrimitives({ ...create().toPrimitives(), dueDate: new Date(Date.now() - DAY) });
    expect(overdue.isOverdue()).toBe(true);
    expect(() => overdue.complete()).toThrow('Cannot complete overdue milestone');
    overdue.transitionTo('completed', true);
    expect(overdue.isOverdue()).toBe(false);
  });

  it('due-date arithmetic and risk', () => {
    expect(create().getDaysUntilDue()).toBeNull();
    expect(create().isAtRisk()).toBe(false);
    const soon = create(future(3));
    expect(soon.getDaysUntilDue()).toBe(3);
    expect(soon.isAtRisk()).toBe(true);
    expect(create(future(30)).isAtRisk()).toBe(false);
  });

  it('updates details and due date, and round-trips through primitives', () => {
    const m = create();
    m.updateDetails(' Beta ', ' second ');
    expect(() => m.updateDetails(' ')).toThrow('must not be empty');
    const due = future(10);
    m.updateDueDate(due);
    expect(() => m.updateDueDate(new Date(Date.now() - DAY))).toThrow('future');
    expect([m.getName(), m.getDescription(), m.getDueDate(), m.getStatus(), m.getProjectId()]).toEqual(['Beta', 'second', due, 'pending', 'p1']);
    const copy = Milestone.fromPrimitives(m.toPrimitives());
    expect(copy.toPrimitives()).toEqual(m.toPrimitives());
    expect(copy.getId()).toBe(m.getId());
    expect(copy.getCreatedAt()).toBeInstanceOf(Date);
    expect(copy.getUpdatedAt()).toBeInstanceOf(Date);
  });
});

describe('Domain exceptions, event facade and events', () => {
  it('exceptions carry a code, details and their own name', () => {
    const cause = new Error('socket closed');
    const cases: Array<[DomainException, string, unknown]> = [
      [new EntityNotFoundException('Project', 'p1'), 'ENTITY_NOT_FOUND', { entityName: 'Project', id: 'p1' }],
      [new ForeignKeyViolationException('Project', 'Task'), 'FOREIGN_KEY_VIOLATION', { entityName: 'Project', referencedEntity: 'Task' }],
      [new UniqueConstraintViolationException('User', 'email'), 'UNIQUE_CONSTRAINT_VIOLATION', { entityName: 'User', field: 'email' }],
      [new RepositoryException('save', 'Task', cause), 'REPOSITORY_ERROR', { operation: 'save', entityName: 'Task', cause: 'socket closed' }],
      [new DatabaseConnectionException(cause), 'DATABASE_CONNECTION_ERROR', { cause: 'socket closed' }],
    ];
    for (const [error, code, details] of cases) {
      expect(error).toBeInstanceOf(DomainException);
      expect(error.code).toBe(code);
      expect(error.details).toEqual(details);
      expect(error.name).toBe(error.constructor.name);
    }
    expect(new EntityNotFoundException('Project', 'p1').message).toBe("Project with id 'p1' not found");
    expect(new RepositoryException('save', 'Task', cause).stack).toBe(cause.stack);
    const denied = new AccessDeniedError('nope');
    expect(denied.message).toBe('nope');
  });

  it('DomainEvents publishes through the bus once wired, and warns otherwise', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    DomainEvents.clearEventBus();
    DomainEvents.raise(new WorkflowPausedEvent('p1', 'budget'));
    expect(warn).toHaveBeenCalled();

    const bus = new EventBus();
    const handled: string[] = [];
    bus.subscribe('workflow.paused', { handle: async (e: any) => { handled.push(`${e.projectId}:${e.reason}`); } });
    DomainEvents.setEventBus(bus);
    DomainEvents.raise(new WorkflowPausedEvent('p1', 'budget'));
    await new Promise(r => setImmediate(r));
    expect(handled).toEqual(['p1:budget']);

    DomainEvents.setEventBus({ publish: () => Promise.reject(new Error('down')) } as any);
    DomainEvents.raise(new WorkflowPausedEvent('p1', 'x'));
    await new Promise(r => setImmediate(r));
    expect(error).toHaveBeenCalled();
    DomainEvents.clearEventBus();
  });
});
