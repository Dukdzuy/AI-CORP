jest.mock('../websocket/websocket.gateway', () => ({ AppWebSocketGateway: class {} }));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskApplicationService } from './task-application.service';
import { TaskDTO } from '../../domain/repositories';
import { TaskStatusChangedEvent } from '../../domain/events/TaskStatusChangedEvent';
import { TaskCompletedEvent } from '../../domain/events/TaskCompletedEvent';

function taskDto(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: 'task-1',
    projectId: 'project-1',
    milestoneId: null,
    title: 'Write login page',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignedAgent: 'dev',
    estimatedCost: null,
    actualCost: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TaskApplicationService', () => {
  let repository: any;
  let eventBus: any;
  let websocketGateway: any;
  let service: TaskApplicationService;

  beforeEach(() => {
    repository = {
      findAll: jest.fn().mockResolvedValue([]),
      findByProjectId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      create: jest.fn(async (data: any) => taskDto(data)),
      update: jest.fn(async (id: string, data: any) => taskDto({ id, ...data })),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    websocketGateway = { sendToProject: jest.fn() };
    service = new TaskApplicationService(repository, eventBus, websocketGateway);
  });

  it('lists all tasks or one project\'s tasks', async () => {
    await service.listTasks();
    expect(repository.findAll).toHaveBeenCalled();
    await service.listTasks('project-1');
    expect(repository.findByProjectId).toHaveBeenCalledWith('project-1');
  });

  describe('createTask', () => {
    it('creates through the entity factory and notifies the board', async () => {
      const result = await service.createTask('project-1', { title: '  Write login page ', description: 'x' });

      const persisted = repository.create.mock.calls[0][0];
      expect(persisted.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(persisted).toEqual(expect.objectContaining({ title: 'Write login page', status: 'todo', priority: 'medium' }));
      expect(result.id).toBe(persisted.id);
      expect(websocketGateway.sendToProject).toHaveBeenCalledWith('project-1', expect.any(Object));
    });

    it('rejects an empty title', async () => {
      await expect(service.createTask('project-1', { title: '  ', description: '' })).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    it('moves review -> done via approve and raises both events', async () => {
      repository.findById.mockResolvedValue(taskDto({ status: 'review' }));
      await service.updateTask('task-1', { status: 'done' });

      expect(repository.update).toHaveBeenCalledWith('task-1', expect.objectContaining({ status: 'done' }));
      const events = eventBus.publish.mock.calls.map((c: any[]) => c[0]);
      expect(events[0]).toBeInstanceOf(TaskStatusChangedEvent);
      expect(events[0]).toEqual(expect.objectContaining({ projectId: 'project-1', oldStatus: 'review', newStatus: 'done' }));
      expect(events[1]).toBeInstanceOf(TaskCompletedEvent);
      expect(events[1]).toEqual(expect.objectContaining({ agentRole: 'dev', taskTitle: 'Write login page' }));
    });

    it('refuses a transition the Kanban rules do not allow', async () => {
      repository.findById.mockResolvedValue(taskDto({ status: 'in_progress' }));
      await expect(service.updateTask('task-1', { status: 'done' })).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('updates details without raising status events', async () => {
      repository.findById.mockResolvedValue(taskDto());
      await service.updateTask('task-1', { title: 'Write signup page', priority: 'high' });
      expect(repository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ title: 'Write signup page', priority: 'high', status: 'todo' })
      );
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown task', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.updateTask('missing', { status: 'in_progress' })).rejects.toThrow(NotFoundException);
    });
  });

  it('persists accrued cost on the task', async () => {
    repository.findById.mockResolvedValue(taskDto({ actualCost: 1.5 }));
    await service.accrueCost('task-1', 2);
    expect(repository.update).toHaveBeenCalledWith('task-1', expect.objectContaining({ actualCost: 3.5 }));
  });
});
