jest.mock('../workflow/workflow.engine', () => ({
  WorkflowEngine: class {},
  WorkflowBlockedError: class extends Error {
    constructor(readonly reason: string, message: string) {
      super(message);
    }
  },
}));
jest.mock('../workflow/workflow-definition.service', () => ({ WorkflowDefinitionService: class {} }));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { WorkflowBlockedError } from '../workflow/workflow.engine';
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
    workflowEngine = {
      startWorkflow: jest.fn().mockResolvedValue('run-1'),
      latestRun: jest.fn().mockResolvedValue(null),
      pauseWorkflow: jest.fn().mockResolvedValue(undefined),
      resumeWorkflow: jest.fn().mockResolvedValue(undefined),
      cancelWorkflow: jest.fn().mockResolvedValue(undefined),
    };
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
        expect.objectContaining({ projectId: persisted.id, goal: GOAL }),
        undefined
      );
    });

    it('starts the instantiated template, pinned to its version, when a template is chosen (Task 19)', async () => {
      workflowDefinitionService.previewTemplate = jest.fn();
      workflowDefinitionService.instantiateTemplate = jest.fn().mockResolvedValue({
        definition: { id: 'ooad-software-project', version: '1.0.0+abc' },
        instance: { parameters: { minUseCases: 3 } },
      });

      await service.createProject({
        name: 'Todo App',
        description: 'A simple todo app',
        goal: GOAL,
        createdById: 'user-1',
        templateId: 'ooad-software-project',
        templateParams: { minUseCases: 3 },
      });

      expect(workflowDefinitionService.previewTemplate).toHaveBeenCalledWith('ooad-software-project', { minUseCases: 3 });
      expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
        expect.any(String),
        'ooad-software-project',
        expect.objectContaining({
          variables: expect.objectContaining({ workflowTemplate: { id: 'ooad-software-project', parameters: { minUseCases: 3 } } }),
        }),
        '1.0.0+abc'
      );
    });

    it('rejects an invalid template choice before creating the project', async () => {
      workflowDefinitionService.previewTemplate = jest.fn(() => {
        throw new BadRequestException('Invalid template parameters');
      });

      await expect(
        service.createProject({ name: 'Todo App', description: 'x', goal: GOAL, createdById: 'user-1', templateId: 'ooad-software-project' })
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a project that breaks an entity rule without persisting it', async () => {
      await expect(
        service.createProject({ name: 'Todo', description: '', goal: 'too short', createdById: 'user-1' })
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('still returns the project when the workflow fails to start, and says so', async () => {
      workflowEngine.startWorkflow.mockRejectedValue(new Error('redis down'));
      const result = await service.createProject({
        name: 'Todo App',
        description: '',
        goal: GOAL,
        createdById: 'user-1',
      });
      expect(result.id).toBeDefined();
      expect(result).toEqual(expect.objectContaining({ workflowStarted: false, workflowError: 'redis down' }));
    });
  });

  describe('startProjectWorkflow', () => {
    it('starts the workflow again when the last run failed', async () => {
      repository.findById.mockResolvedValue(projectDto());
      workflowEngine.latestRun.mockResolvedValue({ id: 'run-0', status: 'failed' });
      await expect(service.startProjectWorkflow('project-1')).resolves.toEqual({ workflowStarted: true });
      expect(workflowEngine.startWorkflow).toHaveBeenCalled();
    });

    it('refuses while a run is still going', async () => {
      repository.findById.mockResolvedValue(projectDto());
      workflowEngine.latestRun.mockResolvedValue({ id: 'run-0', status: 'running' });
      await expect(service.startProjectWorkflow('project-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('updateProject', () => {
    it('applies status changes through the entity state machine', async () => {
      repository.findById.mockResolvedValue(projectDto());
      await service.updateProject('project-1', { status: 'paused' });
      expect(repository.update).toHaveBeenCalledWith('project-1', expect.objectContaining({ status: 'paused' }));
    });

    it('pauses the running workflow with the project', async () => {
      repository.findById.mockResolvedValue(projectDto());
      workflowEngine.latestRun.mockResolvedValue({ id: 'run-1', status: 'running' });
      await service.updateProject('project-1', { status: 'paused' });
      expect(workflowEngine.pauseWorkflow).toHaveBeenCalledWith('run-1');
    });

    it('resumes the paused workflow with the project', async () => {
      repository.findById.mockResolvedValue(projectDto({ status: 'paused' }));
      workflowEngine.latestRun.mockResolvedValue({ id: 'run-1', status: 'paused' });
      await service.updateProject('project-1', { status: 'active' });
      expect(workflowEngine.resumeWorkflow).toHaveBeenCalledWith('run-1');
    });

    it('keeps the project paused when the run may not resume (budget used up)', async () => {
      repository.findById.mockResolvedValue(projectDto({ status: 'paused' }));
      workflowEngine.latestRun.mockResolvedValue({ id: 'run-1', status: 'paused' });
      workflowEngine.resumeWorkflow.mockRejectedValue(new (WorkflowBlockedError as any)('budget_exceeded', 'Project budget exceeded'));
      await expect(service.updateProject('project-1', { status: 'active' })).rejects.toThrow(BadRequestException);
      expect(repository.update).toHaveBeenLastCalledWith('project-1', { status: 'paused' });
    });

    it('stops the workflow when the project is cancelled', async () => {
      repository.findById.mockResolvedValue(projectDto());
      workflowEngine.latestRun.mockResolvedValue({ id: 'run-1', status: 'paused' });
      await service.updateProject('project-1', { status: 'cancelled' });
      expect(workflowEngine.cancelWorkflow).toHaveBeenCalledWith('run-1', 'Project cancelled');
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

  describe('deleteProject', () => {
    it('stops the running workflow before deleting', async () => {
      repository.findById.mockResolvedValue(projectDto());
      workflowEngine.latestRun.mockResolvedValue({ id: 'run-1', status: 'running' });
      await service.deleteProject('project-1');
      expect(workflowEngine.cancelWorkflow).toHaveBeenCalledWith('run-1', 'Project deleted');
      expect(repository.delete).toHaveBeenCalledWith('project-1');
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
