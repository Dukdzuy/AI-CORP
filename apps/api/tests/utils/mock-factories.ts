/**
 * Mock Factories for Testing
 * 
 * Provides factory functions to create mock objects for testing.
 * Follows the Factory Pattern for consistent test data generation.
 * 
 * @module test-utils/mock-factories
 */

import { AgentRole, AgentContext, ChatResult, ToolResult } from '@ai-corp/shared-types';

/**
 * Create a mock AgentContext for testing
 */
export function createMockAgentContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    task: 'Test task',
    taskId: 'task-123',
    projectId: 'project-456',
    workflowRunId: 'workflow-789',
    projectContext: {
      goal: 'Test project goal',
      description: 'Test project description',
      name: 'Test Project',
    },
    relevantMemories: [],
    availableTools: [],
    variables: {},
    ...overrides,
  };
}

/**
 * Create a mock ChatResult from LLM
 */
export function createMockChatResult(overrides?: Partial<ChatResult>): ChatResult {
  return {
    content: 'Mock LLM response',
    requestedModel: 'openrouter/openrouter/free',
    actualModelUsed: 'openrouter/openrouter/free',
    actualProvider: 'opencode',
    isFallbackTriggered: false,
    tokenUsage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    rtkTokenSaved: 0,
    ...overrides,
  };
}

/**
 * Create a mock ToolResult
 */
export function createMockToolResult(overrides?: Partial<ToolResult>): ToolResult {
  return {
    success: true,
    output: 'Mock tool output',
    executionTimeMs: 100,
    resourceUsage: {
      memoryMB: 128,
      cpuPercent: 50,
    },
    ...overrides,
  };
}

/**
 * Create a mock Memory Service
 */
export function createMockMemoryService() {
  return {
    saveMemory: jest.fn().mockResolvedValue('memory-id-123'),
    searchMemories: jest.fn().mockResolvedValue([]),
    getMemory: jest.fn().mockResolvedValue(null),
    deleteMemory: jest.fn().mockResolvedValue(true),
    pruneOldMemories: jest.fn().mockResolvedValue(0),
    getMemoriesByNamespace: jest.fn().mockResolvedValue([]),
    getMemoryStats: jest.fn().mockResolvedValue({}),
    getAgentIdByRole: jest.fn().mockResolvedValue('agent-id-123'),
    getModelConfigForAgent: jest.fn().mockResolvedValue({
      provider: 'opencode',
      model: 'openrouter/openrouter/free',
    }),
  };
}

/**
 * Create a mock LLM Provider
 */
export function createMockLLMProvider() {
  return {
    chat: jest.fn().mockResolvedValue(createMockChatResult()),
    validateConfig: jest.fn().mockResolvedValue(true),
    getProviderName: jest.fn().mockReturnValue('mock-provider'),
  };
}

/**
 * Create a mock Tool Executor
 */
export function createMockToolExecutor() {
  return {
    execute: jest.fn().mockResolvedValue(createMockToolResult()),
  };
}

/**
 * Create a mock Sandbox Executor
 */
export function createMockSandboxExecutor() {
  return {
    executeInSandbox: jest.fn().mockResolvedValue(createMockToolResult()),
    healthCheck: jest.fn().mockResolvedValue(true),
  };
}

/**
 * Create a mock Tool Registry
 */
export function createMockToolRegistry() {
  return {
    registerTool: jest.fn(),
    getTool: jest.fn().mockReturnValue(null),
    getToolsForAgent: jest.fn().mockReturnValue([]),
    isToolAuthorizedForRole: jest.fn().mockReturnValue(true),
    getToolRoles: jest.fn().mockReturnValue([]),
    getAllTools: jest.fn().mockReturnValue([]),
    getToolCount: jest.fn().mockReturnValue(0),
  };
}

/**
 * Create a mock API Usage Service
 */
export function createMockApiUsageService() {
  return {
    logUsage: jest.fn().mockResolvedValue(undefined),
    getUsageByProject: jest.fn().mockResolvedValue([]),
    getUsageByAgent: jest.fn().mockResolvedValue([]),
    getTotalCost: jest.fn().mockResolvedValue(0),
  };
}

/**
 * Create a mock WebSocket Gateway
 */
export function createMockWebSocketGateway() {
  return {
    sendToProject: jest.fn(),
    broadcastEvent: jest.fn(),
    server: null,
  };
}

/**
 * Create a mock Agent Observer
 */
export function createMockAgentObserver() {
  return {
    onStateChanged: jest.fn(),
    onThinkingStarted: jest.fn(),
    onActionCompleted: jest.fn(),
  };
}

/**
 * Create a mock Prisma Service
 */
export function createMockPrismaService() {
  return {
    agent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    agentMemory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    milestone: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    workflowRun: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    workflowStep: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    approval: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    agentMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

/**
 * Builder pattern for complex mock objects
 */
export class MockAgentContextBuilder {
  private context: Partial<AgentContext> = {};

  withTask(task: string): this {
    this.context.task = task;
    return this;
  }

  withProjectId(projectId: string): this {
    this.context.projectId = projectId;
    return this;
  }

  withGoal(goal: string): this {
    if (!this.context.projectContext) {
      this.context.projectContext = {};
    }
    this.context.projectContext.goal = goal;
    return this;
  }

  withMemories(memories: any[]): this {
    this.context.relevantMemories = memories;
    return this;
  }

  withVariables(variables: Record<string, unknown>): this {
    this.context.variables = variables;
    return this;
  }

  build(): AgentContext {
    return createMockAgentContext(this.context);
  }
}

/**
 * Helper to create a builder
 */
export function mockAgentContext(): MockAgentContextBuilder {
  return new MockAgentContextBuilder();
}
