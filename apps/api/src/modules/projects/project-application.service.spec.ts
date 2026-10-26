jest.mock('../workflow/workflow.engine', () => ({ WorkflowEngine: class {} }));
jest.mock('../workflow/workflow-definition.service', () => ({ WorkflowDefinitionService: class {} }));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectApplicationService } from './project-application.service';
import { ProjectDTO } from '../../domain/repositories';
import { ProjectCreatedEvent } from '../../domain/events/ProjectCreatedEvent';
import { BudgetExceededEvent } from '../../domain/events/BudgetExceededEvent';

const GOAL = 'Build a todo app with authentication';

function projectDto(overrides: Partial<ProjectDTO> = {}): ProjectDTO {
  return {
    id: 'project-1',
    name: 'Todo App',
    description: 'A simple todo app',
    goal: GOAL,
    status: 'active',
    budget: 100,
    costAccrued: 0,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProjectApplicationService', () => {
  let repository: any;
  let eventBus: any;
  let workflowEngine: any;
  let workflowDefinitionService: any;
  let service: ProjectApplicationService;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(async (data: any) => projectDto({ ...data, budget: data.budget ?? null })),
      update: jest.fn(async (id: string, data: any) => projectDto({ id, ...data })),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    workflowEngine = { startWorkflow: jest.fn().mockResolvedValue('run-1') };
    workflowDefinitionService = { getDefaultWorkflowDefinition: jest.fn(() => ({ id: 'default' })) };
    service = new ProjectApplicationService(repository, eventBus, workflowEngine, workflowDefinitionService);
  });

  describe('createProject', () => {
    it('persists the entity-assigned id, raises ProjectCreatedEvent and starts the workflow', async () => {
      const result = await service.createProject({
        name: '  Todo App  ',
        description: 'A simple todo app',
        goal: GOAL,
        budget: 50,
        createdById: 'user-1',
      });

      const persisted = repository.create.mock.calls[0][0];
      expect(persisted.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(persisted.name).toBe('Todo App'); // trimmed by the entity
      expect(persisted.budget).toBe(50);
      expect(result.id).toBe(persisted.id);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(ProjectCreatedEvent));
      expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
        persisted.id,
        'default',
        expect.objectContaining({ projectId: persisted.id, goal: GOAL })
      );
    });

    it('rejects a project that breaks an entity rule without persisting it', async () => {
      await expect(
        service.createProject({ name: 'Todo', description: '', goal: 'too short', createdById: 'user-1' })
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('still returns the project when the workflow fails to start', async () => {
      workflowEngine.startWorkflow.mockRejectedValue(new Error('redis down'));
      const result = await service.createProject({
        name: 'Todo App',
        description: '',
        goal: GOAL,
        createdById: 'user-1',
      });
      expect(result.id).toBeDefined();
    });
  });

  describe('updateProject', () => {
    it('applies status changes through the entity state machine', async () => {
      repository.findById.mockResolvedValue(projectDto());
      await service.updateProject('project-1', { status: 'paused' });
      expect(repository.update).toHaveBeenCalledWith('project-1', expect.objectContaining({ status: 'paused' }));
    });

    it('refuses an invalid transition', async () => {
      repository.findById.mockResolvedValue(projectDto({ status: 'completed' }));
      await expect(service.updateProject('project-1', { status: 'active' })).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('refuses a non-positive budget', async () => {
      repository.findById.mockResolvedValue(projectDto());
      await expect(service.updateProject('project-1', { budget: 0 })).rejects.toThrow(BadRequestException);
    });

    it('returns 404 for an unknown project', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.updateProject('missing', { name: 'New name' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('accrueCost', () => {
    it('auto-pauses and raises BudgetExceededEvent when the budget is crossed', async () => {
      repository.findById.mockResolvedValue(projectDto({ budget: 10, costAccrued: 8 }));
      await service.accrueCost('project-1', 5);

      expect(repository.update).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ costAccrued: 13, status: 'paused' })
      );
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(BudgetExceededEvent));
    });

    it('does not raise BudgetExceededEvent while under budget', async () => {
      repository.findById.mockResolvedValue(projectDto({ budget: 10, costAccrued: 1 }));
      await service.accrueCost('project-1', 2);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });
});
