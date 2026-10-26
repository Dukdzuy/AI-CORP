# Interface Documentation

## Document Information
- **Project**: AI-CORP - Multi-Agent Platform
- **Document Type**: Interface Specifications
- **Version**: 1.0
- **Date**: January 2025

---

## 1. Overview

This document catalogs all key interfaces in the AI-CORP system, following the **Interface Segregation Principle** (ISP) from SOLID. Each interface is focused, cohesive, and defines a clear contract for implementers.

Interfaces serve as:
- **Contracts**: Define behavior without implementation
- **Abstractions**: Enable Dependency Inversion Principle
- **Extension Points**: Allow new implementations without modifying existing code
- **Test Doubles**: Facilitate mocking and testing

---

## 2. Agent Interfaces

### 2.1 IAgent

**Purpose**: Core contract that all agent implementations must follow.

**Module**: `domain/agent/interfaces/IAgent.interface.ts`

**Design Principles**:
- Interface Segregation: Focused on core agent behavior
- Dependency Inversion: Clients depend on abstraction, not concrete agents
- Open/Closed: Open for extension (new agent types), closed for modification

**Methods**:

```typescript
interface IAgent {
  // Identity
  getId(): string;
  getRole(): AgentRole;
  
  // State Management
  getState(): AgentState;
  
  // Core Execution
  execute(context: AgentContext): Promise<AgentResult>;
  
  // Observer Pattern
  addEventListener(observer: IAgentObserver): void;
  removeEventListener(observer: IAgentObserver): void;
}
```

**Method Specifications**:

#### `getId(): string`
- **Purpose**: Get unique agent identifier
- **Returns**: UUID string
- **Postcondition**: Never returns null or empty string

#### `getRole(): AgentRole`
- **Purpose**: Get agent's functional role
- **Returns**: AgentRole enum value (CEO, PM, DEV, QA, QC, MARKETING, BA, ARCHITECT)
- **Postcondition**: Always returns valid role

#### `getState(): AgentState`
- **Purpose**: Get agent's current execution state
- **Returns**: AgentState enum value
- **Postcondition**: Returns current state from state machine

#### `execute(context: AgentContext): Promise<AgentResult>`
- **Purpose**: Execute the agent's think-act cycle
- **Preconditions**:
  - Context must be valid (non-null, with taskId and projectId)
  - Agent must be in IDLE state
- **Process**:
  1. Transition to THINKING state
  2. Call think() to analyze and plan
  3. Transition to ACTING state
  4. Call act() to execute planned actions
  5. Transition to COMPLETED or ERROR state
- **Returns**: AgentResult with thought and action results
- **Throws**: Error if execution fails
- **Postcondition**: Agent in COMPLETED or ERROR state

#### `addEventListener(observer: IAgentObserver): void`
- **Purpose**: Register observer for agent events
- **Precondition**: Observer must implement IAgentObserver
- **Effect**: Observer receives state change, thinking, and action events
- **Idempotent**: Adding same observer twice has no additional effect

#### `removeEventListener(observer: IAgentObserver): void`
- **Purpose**: Unregister observer
- **Effect**: Observer no longer receives events
- **Safe**: Removing non-existent observer is no-op

**Implementing Classes**:
- `BaseAgent` (abstract)
- `CeoAgent`, `BaAgent`, `ArchitectAgent`, `PmAgent`, `DevAgent`, `QcAgent`, `QaAgent`, `MarketingAgent` (all extend `BaseAgent`, collected by the `AGENTS` token)

**Example Usage**:
```typescript
const agent: IAgent = agentFactory.createAgent(AgentRole.DEV);
agent.addEventListener(loggingObserver);
agent.addEventListener(websocketObserver);

const result = await agent.execute({
  taskId: 'task-123',
  projectId: 'proj-456',
  task: 'Implement user authentication',
  // ... other context
});

console.log(result.thought.reasoning);
console.log(result.action.success);
```

---

### 2.2 IAgentObserver

**Purpose**: Observer interface for listening to agent lifecycle events.

**Module**: `domain/agent/interfaces/IAgentObserver.interface.ts`

**Design Pattern**: Observer Pattern (Gang of Four)

**Methods** (all optional):

```typescript
interface IAgentObserver {
  onStateChanged?(event: StateChangedEvent): void;
  onThinkingStarted?(event: ThinkingEvent): void;
  onThinkingCompleted?(event: ThinkingCompletedEvent): void;
  onActionStarted?(event: ActionStartedEvent): void;
  onActionCompleted?(event: ActionEvent): void;
  onApprovalRequested?(event: ApprovalRequestedEvent): void;
  onApprovalReceived?(event: ApprovalReceivedEvent): void;
  onError?(event: ErrorEvent): void;
}
```

**Method Specifications**:

All methods are optional, allowing partial implementation (Interface Segregation).

#### `onStateChanged?(event: StateChangedEvent): void`
- **When**: Called when agent transitions between states
- **Event Data**:
  - `agentId: string` - Agent identifier
  - `agentRole: AgentRole` - Agent role
  - `previousState: AgentState` - State before transition
  - `currentState: AgentState` - State after transition
  - `timestamp: Date` - When transition occurred
  - `reason?: string` - Optional transition reason

#### `onThinkingStarted?(event: ThinkingEvent): void`
- **When**: Called when agent starts thinking phase
- **Event Data**:
  - `agentId, agentRole, taskId`
  - `message: string` - Thinking description
  - `timestamp: Date`

#### `onActionCompleted?(event: ActionEvent): void`
- **When**: Called when agent completes an action
- **Event Data**:
  - `agentId, agentRole, taskId`
  - `actionType: string` - Type of action
  - `toolName: string` - Tool used
  - `parameters: Record<string, unknown>` - Action parameters
  - `result?: AgentActionResult` - Action result
  - `timestamp: Date`

**Implementing Classes**:
- `WebSocketGateway` - Broadcasts events to frontend
- `AuditLogger` - Logs events for compliance
- `MetricsCollector` - Tracks performance metrics
- `WorkflowEngine` - Coordinates workflow steps

**Example Usage**:
```typescript
class WebSocketObserver implements IAgentObserver {
  onStateChanged(event: StateChangedEvent): void {
    this.broadcast({
      type: 'agent:state_changed',
      payload: event
    });
  }
  
  onActionCompleted(event: ActionEvent): void {
    this.broadcast({
      type: 'agent:action_completed',
      payload: event
    });
  }
}

agent.addEventListener(new WebSocketObserver());
```

---

### 2.3 IThinkingStrategy

**Purpose**: Strategy interface for agent thinking behavior (Strategy Pattern).

**Module**: `domain/agent/interfaces/IThinkingStrategy.interface.ts`

**Design Pattern**: Strategy Pattern

**Methods**:

```typescript
interface IThinkingStrategy {
  think(context: AgentContext): Promise<AgentThought>;
}
```

**Method Specification**:

#### `think(context: AgentContext): Promise<AgentThought>`
- **Purpose**: Analyze task context and formulate plan
- **Preconditions**:
  - Context must be valid
  - Context.task must be non-empty
  - Context.projectId must be valid
- **Process**:
  1. Load relevant memories from vector database
  2. Analyze task requirements
  3. Call LLM for reasoning (if needed)
  4. Extract planned actions from reasoning
  5. Calculate confidence score
- **Returns**: AgentThought with reasoning, planned actions, and confidence
- **Throws**: Error if thinking fails critically
- **Postcondition**: Returns valid thought with confidence 0-1

**AgentThought Structure**:
```typescript
interface AgentThought {
  reasoning: string;              // Natural language explanation
  plannedActions: AgentAction[];  // List of actions to execute
  confidence: number;             // 0-1 confidence score
  metadata?: Record<string, unknown>;
}
```

**Implementing Classes**:
- `CEOThinkingStrategy` - Strategic, high-level thinking
- `PMThinkingStrategy` - Task decomposition and planning
- `DEVThinkingStrategy` - Technical implementation planning
- `QAThinkingStrategy` - Test scenario generation
- `MarketingThinkingStrategy` - Campaign planning

**Example Usage**:
```typescript
const strategy: IThinkingStrategy = new DevThinkingStrategy(
  memoryService,
  llmProvider
);

const thought = await strategy.think({
  taskId: 'task-123',
  task: 'Implement login endpoint',
  projectContext: { goal: 'Build SaaS platform' },
  // ...
});

console.log(thought.reasoning);
// "Technical Analysis: Implementing login requires JWT..."

console.log(thought.plannedActions);
// [{ toolName: 'write_file', parameters: {...}, rationale: '...' }]
```

---

### 2.4 IActionStrategy

**Purpose**: Strategy interface for agent action execution (Strategy Pattern).

**Module**: `domain/agent/interfaces/IActionStrategy.interface.ts`

**Design Pattern**: Strategy Pattern

**Methods**:

```typescript
interface IActionStrategy {
  act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult>;
}
```

**Method Specification**:

#### `act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult>`
- **Purpose**: Execute actions planned during thinking phase
- **Preconditions**:
  - Context must be valid
  - Thought must contain valid planned actions
- **Process**:
  1. Iterate through thought.plannedActions
  2. For each action, execute via tool or LLM
  3. Collect results
  4. Handle errors gracefully (continue or abort based on severity)
  5. Return combined result
- **Returns**: AgentActionResult with success status and output
- **Throws**: Error if critical action fails
- **Postcondition**: All actions attempted, results captured

**AgentActionResult Structure**:
```typescript
interface AgentActionResult {
  success: boolean;               // Overall success status
  output: unknown;                // Combined output from actions
  error?: string;                 // Error message if failed
  metadata?: Record<string, unknown>;
}
```

**Implementing Classes**:
- `CeoActionStrategy` - Delegation and oversight actions
- `DevActionStrategy` - Code writing and execution
- `QAActionStrategy` - Test execution and reporting
- `MarketingActionStrategy` - Content creation and analytics

**Example Usage**:
```typescript
const strategy: IActionStrategy = new DevActionStrategy(
  toolExecutor,
  llmProvider
);

const result = await strategy.act(context, thought);

if (result.success) {
  console.log('Actions completed successfully');
  console.log(result.output);
} else {
  console.error('Action failed:', result.error);
}
```

---

## 3. Tool Interfaces

### 3.1 ITool

**Purpose**: Core interface that all tools must implement.

**Module**: `domain/tool/interfaces/ITool.interface.ts`

**Design Principles**:
- Interface Segregation: Focused on tool behavior
- Template Method: execute() enforces validation before execution
- Dependency Inversion: Tools depend on abstraction

**Methods**:

```typescript
interface ITool {
  getName(): string;
  getDescription(): string;
  getParameters(): Record<string, unknown>;
  validate(params: ToolParams): ValidationResult;
  execute(params: ToolParams): Promise<ToolResult>;
}
```

**Method Specifications**:

#### `getName(): string`
- **Purpose**: Get unique tool identifier
- **Returns**: Tool name (e.g., "write_file", "run_tests")
- **Postcondition**: Never returns null/empty, name is unique

#### `getDescription(): string`
- **Purpose**: Get human-readable tool description
- **Returns**: Description of what tool does
- **Usage**: LLM tool selection, documentation

#### `getParameters(): Record<string, unknown>`
- **Purpose**: Get JSON schema for tool parameters
- **Returns**: JSON Schema object defining required/optional parameters
- **Usage**: Parameter validation, LLM function calling

#### `validate(params: ToolParams): ValidationResult`
- **Purpose**: Validate parameters before execution
- **Precondition**: params is non-null object
- **Returns**: ValidationResult with valid flag and error messages
- **Postcondition**: Returns validation status without side effects

#### `execute(params: ToolParams): Promise<ToolResult>`
- **Purpose**: Execute tool with given parameters
- **Preconditions**:
  - Parameters must be valid (validate() returns true)
  - Tool must have necessary permissions
- **Process** (Template Method):
  1. Validate parameters
  2. Execute tool-specific logic
  3. Return result
- **Returns**: ToolResult with success, output, execution time, resource usage
- **Throws**: Error if execution fails critically

**ToolResult Structure**:
```typescript
interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
  resourceUsage: {
    memoryMB: number;
    cpuPercent: number;
  };
}
```

**Implementing Classes**:
- `WriteFileTool` - Write content to file
- `ReadFileTool` - Read file content
- `RunTestsTool` - Execute test suite
- `DeployTool` - Deploy application
- `CreateMilestoneTool` - Create project milestone

**Example Usage**:
```typescript
const tool: ITool = toolRegistry.getTool('write_file');

const validation = tool.validate({
  path: 'src/index.ts',
  content: 'export const foo = 42;'
});

if (!validation.valid) {
  console.error('Invalid parameters:', validation.errors);
  return;
}

const result = await tool.execute({
  path: 'src/index.ts',
  content: 'export const foo = 42;'
});

console.log('Success:', result.success);
console.log('Execution time:', result.executionTimeMs, 'ms');
```

---

### 3.2 IToolExecutor

**Purpose**: Interface for executing tools in isolated environments (Facade Pattern).

**Module**: `domain/tool/interfaces/IToolExecutor.interface.ts`

**Design Pattern**: Facade Pattern

**Methods**:

```typescript
interface IToolExecutor {
  execute(tool: ITool, params: ToolParams): Promise<ToolResult>;
}
```

**Method Specification**:

#### `execute(tool: ITool, params: ToolParams): Promise<ToolResult>`
- **Purpose**: Execute tool in appropriate environment
- **Preconditions**:
  - Tool must be valid
  - Parameters must be valid
- **Process**:
  1. Check if tool requires sandbox isolation
  2. If yes, execute in Docker container with resource limits
  3. If no, execute directly
  4. Monitor resource usage
  5. Apply timeout
  6. Return result
- **Returns**: ToolResult with execution details
- **Throws**: Error if execution fails or timeout exceeded
- **Security**: Isolates untrusted code execution

**Implementing Classes**:
- `SandboxExecutor` - Executes tools in Docker sandbox

**Example Usage**:
```typescript
const executor: IToolExecutor = new SandboxExecutor(dockerService);

const result = await executor.execute(
  runTestsTool,
  { testPath: './tests' }
);

console.log('Tests passed:', result.success);
console.log('Memory used:', result.resourceUsage.memoryMB, 'MB');
```

---

## 4. Repository Interfaces

### 4.1 IRepository<T>

**Purpose**: Generic repository interface for aggregate persistence.

**Design Pattern**: Repository Pattern

**Methods**:

```typescript
interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  update(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}
```

**Method Specifications**:

#### `findById(id: string): Promise<T | null>`
- **Purpose**: Retrieve entity by unique identifier
- **Returns**: Entity if found, null if not found
- **Throws**: Error if database error occurs

#### `findAll(): Promise<T[]>`
- **Purpose**: Retrieve all entities of type T
- **Returns**: Array of entities (empty if none exist)
- **Warning**: Use with caution on large datasets

#### `save(entity: T): Promise<T>`
- **Purpose**: Persist new entity
- **Precondition**: Entity must not exist (no ID or ID not in database)
- **Returns**: Saved entity with generated ID
- **Postcondition**: Entity persisted to database

#### `update(entity: T): Promise<T>`
- **Purpose**: Update existing entity
- **Precondition**: Entity must exist in database
- **Returns**: Updated entity
- **Throws**: Error if entity not found

#### `delete(id: string): Promise<void>`
- **Purpose**: Delete entity by ID
- **Precondition**: Entity must exist
- **Effect**: Entity removed from database
- **Warning**: May cascade delete related entities

**Implementing Classes**:
- `AgentRepository`
- `ProjectRepository`
- `WorkflowRepository`
- `TaskRepository`
- `ApprovalRepository`

---

### 4.2 IAgentRepository

**Purpose**: Repository for agent aggregate.

**Extends**: `IRepository<Agent>`

**Additional Methods**:

```typescript
interface IAgentRepository extends IRepository<Agent> {
  findByRole(role: AgentRole): Promise<Agent | null>;
  findActive(): Promise<Agent[]>;
  saveMemory(memory: AgentMemory): Promise<void>;
  findMemories(agentId: string, namespace: string): Promise<AgentMemory[]>;
  searchMemoriesByEmbedding(agentId: string, query: string, limit: number): Promise<AgentMemory[]>;
}
```

---

### 4.3 IProjectRepository

**Purpose**: Repository for project aggregate.

**Extends**: `IRepository<Project>`

**Additional Methods**:

```typescript
interface IProjectRepository extends IRepository<Project> {
  findByUser(userId: string): Promise<Project[]>;
  findActive(): Promise<Project[]>;
  findMilestones(projectId: string): Promise<Milestone[]>;
  findTasks(projectId: string): Promise<Task[]>;
  calculateTotalCost(projectId: string): Promise<Money>;
}
```

---

## 5. Event Handler Interfaces

### 5.1 IEventHandler<T>

**Purpose**: Generic interface for domain event handlers.

**Methods**:

```typescript
interface IEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(eventType: string): boolean;
}
```

**Method Specifications**:

#### `handle(event: T): Promise<void>`
- **Purpose**: Handle domain event
- **Precondition**: Event must be valid
- **Effect**: Perform side effects based on event
- **Postcondition**: Event processed (may emit new events)

#### `canHandle(eventType: string): boolean`
- **Purpose**: Check if handler can process event type
- **Returns**: true if handler supports event type

**Implementing Classes**:
- `ProjectCreatedHandler`
- `WorkflowStepCompletedHandler`
- `ApprovalGrantedHandler`

---

## 6. Workflow Interfaces

### 6.1 IWorkflow

**Purpose**: Interface for workflow definition.

**Methods**:

```typescript
interface IWorkflow {
  getId(): string;
  getName(): string;
  getNodes(): WorkflowNode[];
  validate(): ValidationResult;
  execute(context: WorkflowContext): Promise<WorkflowResult>;
}
```

**Implementing Classes**:
- `SequentialWorkflow`
- `ParallelWorkflow`
- `ConditionalWorkflow`

---

## 7. Design Principles Applied

### 7.1 SOLID Principles

**Single Responsibility Principle (SRP)**:
- Each interface has one reason to change
- Example: IThinkingStrategy only defines thinking, not action execution

**Open/Closed Principle (OCP)**:
- Interfaces open for extension (new implementations)
- Closed for modification (interface remains stable)

**Liskov Substitution Principle (LSP)**:
- All implementations can substitute for interface
- Example: Any IAgent implementation works where IAgent is expected

**Interface Segregation Principle (ISP)**:
- Interfaces are focused and minimal
- Example: IAgentObserver methods all optional (clients implement only what they need)

**Dependency Inversion Principle (DIP)**:
- High-level modules depend on abstractions (interfaces)
- Low-level modules implement abstractions
- Example: AgentController depends on IAgent, not concrete CEOAgent

---

### 7.2 Design Patterns

**Strategy Pattern**:
- IThinkingStrategy, IActionStrategy
- Allows runtime behavior swapping

**Observer Pattern**:
- IAgentObserver
- Enables decoupled event notification

**Repository Pattern**:
- IRepository<T>, IAgentRepository, IProjectRepository
- Abstracts persistence layer

**Facade Pattern**:
- IToolExecutor
- Simplifies complex tool execution logic

**Template Method Pattern**:
- ITool.execute() enforces validation before execution

---

## 8. Interface Usage Examples

### 8.1 Dependency Injection with Interfaces

```typescript
class AgentController {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly memoryService: IMemoryService,
    private readonly eventBus: IEventBus
  ) {}
  
  async executeAgent(agentRole: AgentRole, context: AgentContext): Promise<AgentResult> {
    const agent: IAgent = await this.agentRepository.findByRole(agentRole);
    if (!agent) throw new Error('Agent not found');
    
    // Register observers
    agent.addEventListener(this.loggingObserver);
    agent.addEventListener(this.websocketObserver);
    
    // Execute
    const result = await agent.execute(context);
    
    // Publish event
    await this.eventBus.publish(new AgentExecutionCompleted(agent.getId(), result));
    
    return result;
  }
}
```

---

### 8.2 Strategy Pattern Usage

```typescript
class BaseAgent implements IAgent {
  constructor(
    private readonly thinkingStrategy: IThinkingStrategy,
    private readonly actionStrategy: IActionStrategy
  ) {}
  
  async execute(context: AgentContext): Promise<AgentResult> {
    // Use injected strategies
    const thought = await this.thinkingStrategy.think(context);
    const action = await this.actionStrategy.act(context, thought);
    
    return { thought, action };
  }
}

// Different agents use different strategies
const devAgent = new BaseAgent(
  new DEVThinkingStrategy(),
  new DevActionStrategy()
);

const qaAgent = new BaseAgent(
  new QAThinkingStrategy(),
  new QAActionStrategy()
);
```

---

### 8.3 Observer Pattern Usage

```typescript
class WorkflowEngine implements IAgentObserver {
  onActionCompleted(event: ActionEvent): void {
    // Trigger next workflow step when agent completes action
    this.executeNextStep(event.taskId);
  }
  
  onError(event: ErrorEvent): void {
    // Handle agent error in workflow context
    this.failWorkflow(event.taskId, event.error);
  }
}

// Register workflow engine as observer
agent.addEventListener(workflowEngine);
```

---

## 9. Testing with Interfaces

Interfaces facilitate testing through mocking and stubbing:

```typescript
// Mock implementation for testing
class MockAgentRepository implements IAgentRepository {
  private agents: Map<string, Agent> = new Map();
  
  async findByRole(role: AgentRole): Promise<Agent | null> {
    return Array.from(this.agents.values())
      .find(a => a.getRole() === role) || null;
  }
  
  async save(agent: Agent): Promise<Agent> {
    this.agents.set(agent.getId(), agent);
    return agent;
  }
  
  // ... other methods
}

// Use in tests
describe('AgentController', () => {
  it('should execute agent', async () => {
    const mockRepo = new MockAgentRepository();
    const controller = new AgentController(mockRepo);
    
    // Test with mock
    const result = await controller.executeAgent(AgentRole.DEV, context);
    expect(result.success).toBe(true);
  });
});
```

---

## 10. Conclusion

The AI-CORP system's interface design follows industry best practices:

- **10+ core interfaces** defining system contracts
- **SOLID principles** rigorously applied
- **5+ design patterns** implemented through interfaces
- **Testability** through dependency injection and mocking
- **Extensibility** through Open/Closed Principle
- **Maintainability** through separation of concerns

These interfaces form the backbone of the system architecture, enabling loose coupling, high cohesion, and clean separation between domain, application, and infrastructure layers.

---

**Document Version**: 1.0  
**Last Updated**: January 2025
