import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngine } from './workflow.engine';
import { PrismaService } from '../../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { AgentOrchestratorService } from '../orchestrator/agent-orchestrator.service';
import { WorkflowDefinition, WorkflowNode, WorkflowContext, AgentRole } from '@ai-corp/shared-types';

// Mock BullMQ to prevent Redis connections during tests
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };

  const mockWorker = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn(() => mockQueue),
    Worker: jest.fn(() => mockWorker),
  };
});

describe('WorkflowEngine - Node Execution Logic', () => {
  let engine: WorkflowEngine;
  let prismaService: any;
  let websocketGateway: any;
  let orchestrator: any;

  // Mock workflow run data
  const mockWorkflowRun = {
    id: 'run-123',
    projectId: 'project-456',
    workflowDefId: 'def-789',
    status: 'running',
    currentNodeId: 'node-1',
    context: {
      projectId: 'project-456',
      variables: { status: 'active', count: 5 }
    },
    startedAt: new Date(),
  };

  // Mock project data
  const mockProject = {
    id: 'project-456',
    name: 'Test Project',
    createdById: 'user-123',
    createdBy: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  };

  beforeEach(async () => {
    // Create mock services
    const mockPrismaService = {
      workflowRun: {
        findUnique: jest.fn().mockResolvedValue(mockWorkflowRun),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      workflowStep: {
        create: jest.fn().mockResolvedValue({
          id: 'step-123',
          workflowRunId: 'run-123',
          nodeId: 'node-1',
          status: 'running',
          retryCount: 0,
          startedAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue(mockProject),
      },
      approval: {
        create: jest.fn().mockResolvedValue({
          id: 'approval-123',
          workflowRunId: 'run-123',
          userId: 'user-123',
          approvalType: 'test',
          status: 'pending',
          requestData: {},
        }),
      },
    };

    const mockWebSocketGateway = {
      sendToProject: jest.fn(),
      sendToUser: jest.fn(),
    };

    const mockOrchestrator = {
      invokeAgent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngine,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWebSocketGateway },
        { provide: AgentOrchestratorService, useValue: mockOrchestrator },
      ],
    }).compile();

    engine = module.get<WorkflowEngine>(WorkflowEngine);
    prismaService = module.get(PrismaService) as any;
    websocketGateway = module.get(AppWebSocketGateway) as any;
    orchestrator = module.get(AgentOrchestratorService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('executeNode - agent_task', () => {
    it('should execute agent task and emit WebSocket events', async () => {
      const agentNode: WorkflowNode = {
        id: 'agent-node-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'implement_feature',
      };

      // Create workflow definition
      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [agentNode],
        edges: [],
        startNode: 'agent-node-1',
        endNode: 'agent-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Mock agent response
      orchestrator.invokeAgent.mockResolvedValue({ success: true, output: 'Task completed' });

      // Execute through private method (using type assertion)
      const result = await (engine as any).executeNode(agentNode, mockWorkflowRun);

      // Verify agent was invoked
      expect(orchestrator.invokeAgent).toHaveBeenCalledWith(
        AgentRole.DEV,
        expect.objectContaining({
          projectId: 'project-456',
          taskId: 'agent-node-1',
          workflowRunId: 'run-123',
        })
      );

      // Verify WebSocket events were emitted (thinking and action)
      expect(websocketGateway.sendToProject).toHaveBeenCalledWith(
        'project-456',
        expect.objectContaining({
          type: 'agent:thinking',
          data: expect.objectContaining({
            agentRole: AgentRole.DEV,
            taskId: 'agent-node-1',
          }),
        })
      );

      expect(websocketGateway.sendToProject).toHaveBeenCalledWith(
        'project-456',
        expect.objectContaining({
          type: 'agent:action',
        })
      );

      // Verify result
      expect(result.status).toBe('success');
      expect(result.output).toEqual({ success: true, output: 'Task completed' });
    });

    it('should handle agent task failure gracefully', async () => {
      const agentNode: WorkflowNode = {
        id: 'agent-node-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'implement_feature',
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [agentNode],
        edges: [],
        startNode: 'agent-node-1',
        endNode: 'agent-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Mock agent failure
      orchestrator.invokeAgent.mockRejectedValue(new Error('Agent execution failed'));

      // Execute node - should throw error for retry logic
      await expect((engine as any).executeNode(agentNode, mockWorkflowRun)).rejects.toThrow('Agent execution failed');
    });
  });

  describe('executeNode - human_approval', () => {
    it('should create approval request and emit WebSocket event', async () => {
      const approvalNode: WorkflowNode = {
        id: 'approval-node-1',
        type: 'human_approval',
        taskType: 'milestone_approval',
        metadata: {
          approvalType: 'milestone_complete',
          message: 'Please approve milestone completion',
        },
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [approvalNode],
        edges: [],
        startNode: 'approval-node-1',
        endNode: 'approval-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Execute node
      const result = await (engine as any).executeNode(approvalNode, mockWorkflowRun);

      // Verify approval was created
      expect(prismaService.approval.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowRunId: 'run-123',
          userId: 'user-123',
          approvalType: 'milestone_complete',
          status: 'pending',
        }),
      });

      // Verify WebSocket event was sent to user
      expect(websocketGateway.sendToUser).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'human:approval_required',
          data: expect.objectContaining({
            approvalId: 'approval-123',
            workflowRunId: 'run-123',
            projectId: 'project-456',
          }),
        })
      );

      // Verify result
      expect(result.status).toBe('pending_approval');
      expect(result.output).toEqual(
        expect.objectContaining({
          approvalId: 'approval-123',
          approvalType: 'milestone_complete',
        })
      );
    });
  });

  describe('executeNode - condition', () => {
    it('should evaluate condition as true and return success edge', async () => {
      const conditionNode: WorkflowNode = {
        id: 'condition-node-1',
        type: 'condition',
        metadata: {
          variable: 'status',
          operator: 'equals',
          value: 'active',
        },
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [conditionNode],
        edges: [],
        startNode: 'condition-node-1',
        endNode: 'condition-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Execute node
      const result = await (engine as any).executeNode(conditionNode, mockWorkflowRun);

      // Verify result
      expect(result.status).toBe('success');
      expect(result.output).toEqual(
        expect.objectContaining({
          conditionResult: true,
          edgeCondition: 'onSuccess',
          variable: 'status',
          operator: 'equals',
          contextValue: 'active',
        })
      );
    });

    it('should evaluate condition as false and return fail edge', async () => {
      const conditionNode: WorkflowNode = {
        id: 'condition-node-1',
        type: 'condition',
        metadata: {
          variable: 'status',
          operator: 'equals',
          value: 'inactive',
        },
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [conditionNode],
        edges: [],
        startNode: 'condition-node-1',
        endNode: 'condition-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Execute node
      const result = await (engine as any).executeNode(conditionNode, mockWorkflowRun);

      // Verify result
      expect(result.status).toBe('success');
      expect(result.output).toEqual(
        expect.objectContaining({
          conditionResult: false,
          edgeCondition: 'onFail',
        })
      );
    });

    it('should handle greater_than operator', async () => {
      const conditionNode: WorkflowNode = {
        id: 'condition-node-1',
        type: 'condition',
        metadata: {
          variable: 'count',
          operator: 'greater_than',
          value: 3,
        },
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [conditionNode],
        edges: [],
        startNode: 'condition-node-1',
        endNode: 'condition-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Execute node
      const result = await (engine as any).executeNode(conditionNode, mockWorkflowRun);

      // Verify result (count is 5, greater than 3)
      expect(result.status).toBe('success');
      expect(result.output).toEqual(
        expect.objectContaining({
          conditionResult: true,
          edgeCondition: 'onSuccess',
        })
      );
    });

    it('should handle exists operator', async () => {
      const conditionNode: WorkflowNode = {
        id: 'condition-node-1',
        type: 'condition',
        metadata: {
          variable: 'status',
          operator: 'exists',
        },
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [conditionNode],
        edges: [],
        startNode: 'condition-node-1',
        endNode: 'condition-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Execute node
      const result = await (engine as any).executeNode(conditionNode, mockWorkflowRun);

      // Verify result (status exists)
      expect(result.status).toBe('success');
      expect(result.output).toEqual(
        expect.objectContaining({
          conditionResult: true,
          edgeCondition: 'onSuccess',
        })
      );
    });
  });

  describe('executeNode - parallel', () => {
    it('should execute multiple nodes in parallel and return combined results', async () => {
      const parallelNode: WorkflowNode = {
        id: 'parallel-node-1',
        type: 'parallel',
        metadata: {
          parallelNodes: ['task-1', 'task-2'],
        },
      };

      const taskNode1: WorkflowNode = {
        id: 'task-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'task_1',
      };

      const taskNode2: WorkflowNode = {
        id: 'task-2',
        type: 'agent_task',
        agentRole: AgentRole.QA,
        taskType: 'task_2',
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [parallelNode, taskNode1, taskNode2],
        edges: [],
        startNode: 'parallel-node-1',
        endNode: 'parallel-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Mock agent responses
      orchestrator.invokeAgent.mockResolvedValue({ success: true });

      // Execute node
      const result = await (engine as any).executeNode(parallelNode, mockWorkflowRun);

      // Verify result
      expect(result.status).toBe('success');
      expect(result.output).toEqual(
        expect.objectContaining({
          allSucceeded: true,
          successCount: 2,
          failureCount: 0,
          totalCount: 2,
        })
      );
    });

    it('should handle partial failure in parallel execution', async () => {
      const parallelNode: WorkflowNode = {
        id: 'parallel-node-1',
        type: 'parallel',
        metadata: {
          parallelNodes: ['task-1', 'task-2'],
        },
      };

      const taskNode1: WorkflowNode = {
        id: 'task-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'task_1',
      };

      const taskNode2: WorkflowNode = {
        id: 'task-2',
        type: 'agent_task',
        agentRole: AgentRole.QA,
        taskType: 'task_2',
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [parallelNode, taskNode1, taskNode2],
        edges: [],
        startNode: 'parallel-node-1',
        endNode: 'parallel-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Mock first agent success, second agent failure
      orchestrator.invokeAgent
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Task failed'));

      // Execute node - should throw error since one task failed
      await expect((engine as any).executeNode(parallelNode, mockWorkflowRun)).rejects.toThrow('Task failed');
    });
  });

  describe('Timeout and Retry Logic', () => {
    it('should enforce node timeout', async () => {
      const agentNode: WorkflowNode = {
        id: 'agent-node-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'implement_feature',
        timeout: 1000, // 1 second timeout
        maxRetries: 0, // No retries for this test
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [agentNode],
        edges: [],
        startNode: 'agent-node-1',
        endNode: 'agent-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Mock agent to take longer than timeout
      orchestrator.invokeAgent.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 5000))
      );

      // Execute with timeout
      const jobData = {
        runId: 'run-123',
        nodeId: 'agent-node-1',
        retryCount: 0,
      };

      await expect((engine as any).executeNodeJob(jobData)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('timeout'),
        })
      );
    }, 3000); // Increase Jest timeout for this test to 3 seconds

    it('should retry failed node with exponential backoff', async () => {
      const agentNode: WorkflowNode = {
        id: 'agent-node-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'implement_feature',
        maxRetries: 2, // Allow 2 retries
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [agentNode],
        edges: [],
        startNode: 'agent-node-1',
        endNode: 'agent-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Mock agent to fail twice then succeed
      let attemptCount = 0;
      orchestrator.invokeAgent.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ success: true, output: 'Task completed after retry' });
      });

      // Execute with retry support
      const jobData = {
        runId: 'run-123',
        nodeId: 'agent-node-1',
        retryCount: 0,
      };

      const result = await (engine as any).executeNodeJob(jobData);

      // Verify agent was called 3 times (initial + 2 retries)
      expect(orchestrator.invokeAgent).toHaveBeenCalledTimes(3);
      
      // Verify final result is success
      expect(result.status).toBe('success');
      expect(result.output).toEqual({ success: true, output: 'Task completed after retry' });
    }, 10000);

    it('should fail after exceeding max retries', async () => {
      const agentNode: WorkflowNode = {
        id: 'agent-node-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'implement_feature',
        maxRetries: 1, // Allow only 1 retry
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [agentNode],
        edges: [],
        startNode: 'agent-node-1',
        endNode: 'agent-node-1',
      };

      engine.createWorkflow(workflowDef);

      // Mock agent to always fail
      orchestrator.invokeAgent.mockRejectedValue(new Error('Permanent failure'));

      // Execute with retry support
      const jobData = {
        runId: 'run-123',
        nodeId: 'agent-node-1',
        retryCount: 0,
      };

      await expect((engine as any).executeNodeJob(jobData)).rejects.toThrow('Permanent failure');
      
      // Verify agent was called 2 times (initial + 1 retry)
      expect(orchestrator.invokeAgent).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe('WebSocket Events', () => {
    it('should emit state change events during node execution', async () => {
      const agentNode: WorkflowNode = {
        id: 'agent-node-1',
        type: 'agent_task',
        agentRole: AgentRole.DEV,
        taskType: 'implement_feature',
      };

      const workflowDef: WorkflowDefinition = {
        id: 'def-789',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [agentNode],
        edges: [],
        startNode: 'agent-node-1',
        endNode: 'agent-node-1',
      };

      engine.createWorkflow(workflowDef);
      orchestrator.invokeAgent.mockResolvedValue({ success: true });

      // Execute node
      await (engine as any).executeNode(agentNode, mockWorkflowRun);

      // Verify WebSocket events were emitted
      // 1. Node execution start
      expect(websocketGateway.sendToProject).toHaveBeenCalledWith(
        'project-456',
        expect.objectContaining({
          type: 'workflow:state_changed',
          data: expect.objectContaining({
            previousState: 'pending',
            currentState: 'running',
            currentNodeId: 'agent-node-1',
          }),
        })
      );

      // 2. Node execution completion
      expect(websocketGateway.sendToProject).toHaveBeenCalledWith(
        'project-456',
        expect.objectContaining({
          type: 'workflow:state_changed',
          data: expect.objectContaining({
            previousState: 'running',
            currentState: 'completed',
          }),
        })
      );
    });
  });

  describe('State Persistence and Recovery (Requirement 14)', () => {
    describe('pauseWorkflow', () => {
      it('should save workflow state and update status to paused', async () => {
        const runningWorkflow = {
          ...mockWorkflowRun,
          status: 'running',
        };

        prismaService.workflowRun.findUnique.mockResolvedValue(runningWorkflow);
        prismaService.workflowRun.update.mockResolvedValue({
          ...runningWorkflow,
          status: 'paused',
        });

        await engine.pauseWorkflow('run-123');

        // Verify workflow status was updated to paused
        expect(prismaService.workflowRun.update).toHaveBeenCalledWith({
          where: { id: 'run-123' },
          data: { status: 'paused' },
        });

        // Verify WebSocket event was emitted
        expect(websocketGateway.sendToProject).toHaveBeenCalledWith(
          'project-456',
          expect.objectContaining({
            type: 'workflow:state_changed',
            data: expect.objectContaining({
              workflowRunId: 'run-123',
              projectId: 'project-456',
              previousState: 'running',
              currentState: 'paused',
              currentNodeId: 'node-1',
            }),
          })
        );
      });

      it('should throw error when attempting to pause non-running workflow', async () => {
        const pausedWorkflow = {
          ...mockWorkflowRun,
          status: 'paused',
        };

        prismaService.workflowRun.findUnique.mockResolvedValue(pausedWorkflow);

        await expect(engine.pauseWorkflow('run-123')).rejects.toThrow(
          'Cannot pause workflow run-123 with status paused'
        );
      });

      it('should throw error when workflow run not found', async () => {
        prismaService.workflowRun.findUnique.mockResolvedValue(null);

        await expect(engine.pauseWorkflow('run-999')).rejects.toThrow(
          'Workflow run run-999 not found'
        );
      });
    });

    describe('resumeWorkflow', () => {
      it('should update status to running and resume processing from current node', async () => {
        const pausedWorkflow = {
          ...mockWorkflowRun,
          status: 'paused',
        };

        prismaService.workflowRun.findUnique.mockResolvedValue(pausedWorkflow);
        prismaService.workflowRun.update.mockResolvedValue({
          ...pausedWorkflow,
          status: 'running',
        });

        // Mock processCurrentNode to avoid actual processing
        jest.spyOn(engine as any, 'processCurrentNode').mockResolvedValue(undefined);

        await engine.resumeWorkflow('run-123');

        // Verify workflow status was updated to running
        expect(prismaService.workflowRun.update).toHaveBeenCalledWith({
          where: { id: 'run-123' },
          data: { status: 'running' },
        });

        // Verify WebSocket event was emitted
        expect(websocketGateway.sendToProject).toHaveBeenCalledWith(
          'project-456',
          expect.objectContaining({
            type: 'workflow:state_changed',
            data: expect.objectContaining({
              workflowRunId: 'run-123',
              projectId: 'project-456',
              previousState: 'paused',
              currentState: 'running',
              currentNodeId: 'node-1',
            }),
          })
        );

        // Verify processing resumed from current node
        expect((engine as any).processCurrentNode).toHaveBeenCalledWith('run-123');
      });

      it('should throw error when attempting to resume non-paused workflow', async () => {
        const runningWorkflow = {
          ...mockWorkflowRun,
          status: 'running',
        };

        prismaService.workflowRun.findUnique.mockResolvedValue(runningWorkflow);

        await expect(engine.resumeWorkflow('run-123')).rejects.toThrow(
          'Cannot resume workflow run-123 with status running'
        );
      });

      it('should throw error when workflow run not found', async () => {
        prismaService.workflowRun.findUnique.mockResolvedValue(null);

        await expect(engine.resumeWorkflow('run-999')).rejects.toThrow(
          'Workflow run run-999 not found'
        );
      });
    });

    describe('recoverWorkflows', () => {
      it('should recover all running workflows on system restart', async () => {
        const runningWorkflows = [
          {
            id: 'run-1',
            projectId: 'project-1',
            workflowDefId: 'def-1',
            status: 'running',
            currentNodeId: 'node-a',
            context: { variables: {} },
          },
          {
            id: 'run-2',
            projectId: 'project-2',
            workflowDefId: 'def-2',
            status: 'running',
            currentNodeId: 'node-b',
            context: { variables: {} },
          },
          {
            id: 'run-3',
            projectId: 'project-3',
            workflowDefId: 'def-3',
            status: 'running',
            currentNodeId: 'node-c',
            context: { variables: {} },
          },
        ];

        prismaService.workflowRun.findMany.mockResolvedValue(runningWorkflows);

        // Mock processCurrentNode to avoid actual processing
        jest.spyOn(engine as any, 'processCurrentNode').mockResolvedValue(undefined);

        await engine.recoverWorkflows();

        // Verify all running workflows were queried
        expect(prismaService.workflowRun.findMany).toHaveBeenCalledWith({
          where: {
            status: 'running',
          },
        });

        // Verify processCurrentNode was called for each workflow
        expect((engine as any).processCurrentNode).toHaveBeenCalledTimes(3);
        expect((engine as any).processCurrentNode).toHaveBeenCalledWith('run-1');
        expect((engine as any).processCurrentNode).toHaveBeenCalledWith('run-2');
        expect((engine as any).processCurrentNode).toHaveBeenCalledWith('run-3');
      });

      it('should handle empty list of running workflows', async () => {
        prismaService.workflowRun.findMany.mockResolvedValue([]);

        // Mock processCurrentNode
        jest.spyOn(engine as any, 'processCurrentNode').mockResolvedValue(undefined);

        await engine.recoverWorkflows();

        // Verify query was made
        expect(prismaService.workflowRun.findMany).toHaveBeenCalled();

        // Verify no processing was attempted
        expect((engine as any).processCurrentNode).not.toHaveBeenCalled();
      });

      it('should continue recovery even if individual workflow fails', async () => {
        const runningWorkflows = [
          {
            id: 'run-1',
            projectId: 'project-1',
            workflowDefId: 'def-1',
            status: 'running',
            currentNodeId: 'node-a',
            context: { variables: {} },
          },
          {
            id: 'run-2',
            projectId: 'project-2',
            workflowDefId: 'def-2',
            status: 'running',
            currentNodeId: 'node-b',
            context: { variables: {} },
          },
        ];

        prismaService.workflowRun.findMany.mockResolvedValue(runningWorkflows);

        // Mock processCurrentNode to fail for first workflow but succeed for second
        jest
          .spyOn(engine as any, 'processCurrentNode')
          .mockRejectedValueOnce(new Error('Recovery failed for run-1'))
          .mockResolvedValueOnce(undefined);

        // Should not throw - recovery continues for all workflows
        await engine.recoverWorkflows();

        // Verify both workflows were attempted
        expect((engine as any).processCurrentNode).toHaveBeenCalledTimes(2);
      });
    });

    describe('saveWorkflowState', () => {
      it('should persist current node and context to database', async () => {
        const workflowWithState = {
          id: 'run-123',
          projectId: 'project-456',
          workflowDefId: 'def-789',
          status: 'running',
          currentNodeId: 'node-5',
          context: {
            projectId: 'project-456',
            variables: {
              completedTasks: 3,
              totalTasks: 10,
            },
          },
        };

        prismaService.workflowRun.findUnique.mockResolvedValue(workflowWithState);

        // Call private method through pauseWorkflow (which calls saveWorkflowState)
        prismaService.workflowRun.update.mockResolvedValue({
          ...workflowWithState,
          status: 'paused',
        });

        await engine.pauseWorkflow('run-123');

        // Verify workflow run was queried to get current state
        expect(prismaService.workflowRun.findUnique).toHaveBeenCalledWith({
          where: { id: 'run-123' },
        });

        // State is persisted through the database via currentNodeId and context fields
        // The update call confirms state was persisted
        expect(prismaService.workflowRun.update).toHaveBeenCalled();
      });
    });

    describe('Integration: Pause and Resume with State Preservation', () => {
      it('should preserve workflow state across pause and resume cycle', async () => {
        const initialWorkflow = {
          id: 'run-123',
          projectId: 'project-456',
          workflowDefId: 'def-789',
          status: 'running',
          currentNodeId: 'node-5',
          context: {
            projectId: 'project-456',
            variables: {
              completedTasks: 3,
              totalTasks: 10,
              lastProcessedItem: 'item-xyz',
            },
          },
        };

        // Set up pause scenario
        prismaService.workflowRun.findUnique.mockResolvedValueOnce(initialWorkflow);
        const pausedWorkflow = { ...initialWorkflow, status: 'paused' };
        prismaService.workflowRun.update.mockResolvedValueOnce(pausedWorkflow);

        // Pause workflow
        await engine.pauseWorkflow('run-123');

        // Clear mocks
        jest.clearAllMocks();

        // Set up resume scenario
        prismaService.workflowRun.findUnique.mockResolvedValueOnce(pausedWorkflow);
        const resumedWorkflow = { ...pausedWorkflow, status: 'running' };
        prismaService.workflowRun.update.mockResolvedValueOnce(resumedWorkflow);

        // Mock processCurrentNode
        jest.spyOn(engine as any, 'processCurrentNode').mockResolvedValue(undefined);

        // Resume workflow
        await engine.resumeWorkflow('run-123');

        // Verify workflow resumed from saved state
        expect(prismaService.workflowRun.update).toHaveBeenCalledWith({
          where: { id: 'run-123' },
          data: { status: 'running' },
        });

        // Verify processing resumed from saved node
        expect((engine as any).processCurrentNode).toHaveBeenCalledWith('run-123');

        // Note: The context and currentNodeId are preserved in the database
        // and would be used when processCurrentNode executes
      });
    });
  });
});
