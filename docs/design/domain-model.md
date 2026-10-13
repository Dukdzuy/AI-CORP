# Domain Model Documentation

## Document Information
- **Project**: AI-CORP - Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation
- **Document Type**: Domain Model Analysis
- **Version**: 1.0
- **Date**: January 2025
- **Author**: AI-CORP Development Team

---

## 1. Domain Overview

### 1.1 Purpose of Domain Model

The domain model represents the conceptual foundation of the AI-CORP multi-agent platform. It captures the essential business concepts, their relationships, and the rules that govern their interactions. This model serves as:

- **Ubiquitous Language**: A shared vocabulary between domain experts, developers, and stakeholders
- **Design Blueprint**: The foundation for system architecture and implementation
- **Communication Tool**: Facilitates understanding between technical and non-technical stakeholders
- **Validation Reference**: Ensures business logic correctness throughout development

### 1.2 Domain-Driven Design (DDD) Concepts Applied

AI-CORP applies DDD principles to manage complexity and align software design with business needs:

#### **1.2.1 Entities**
Objects with unique identity that persists over time, independent of their attributes.

**Key Characteristics**:
- Unique identifier (UUID)
- Mutable state
- Identity equality (two entities are equal if their IDs match)
- Lifecycle management

**Examples in AI-CORP**: Agent, Project, WorkflowRun, Task, User

#### **1.2.2 Value Objects**
Immutable objects defined by their attributes rather than identity.

**Key Characteristics**:
- No unique identifier
- Immutability (cannot change after creation)
- Value equality (two value objects are equal if all attributes match)
- Self-validation

**Examples in AI-CORP**: AgentRole, TaskStatus, Money, TimeRange, ModelRouteConfig

#### **1.2.3 Aggregates**
Clusters of entities and value objects treated as a single unit for data consistency.

**Key Characteristics**:
- Aggregate Root: Entry point for all external access
- Consistency Boundary: Changes within aggregate are transactionally consistent
- Reference by Identity: External aggregates reference each other by ID, not direct object references
- Invariant Enforcement: Business rules enforced at aggregate boundary

**Examples in AI-CORP**: 
- **Project Aggregate**: Project (root) → Milestone → Task
- **Workflow Aggregate**: WorkflowRun (root) → WorkflowStep → Approval
- **Agent Aggregate**: Agent (root) → AgentMemory → AgentMessage

#### **1.2.4 Repositories**
Abstractions for accessing aggregates, providing illusion of in-memory collections.

**Key Characteristics**:
- Collection-like interface
- Persistence ignorance at domain layer
- Access aggregates by root only
- Hide database complexity

**Examples in AI-CORP**: IAgentRepository, IProjectRepository, IWorkflowRepository

#### **1.2.5 Domain Events**
Significant occurrences in the domain that domain experts care about.

**Key Characteristics**:
- Past-tense naming (e.g., ProjectCreated, not CreateProject)
- Immutable
- Timestamp of occurrence
- Rich payload with event details
- Enable loose coupling between aggregates

**Examples in AI-CORP**: ProjectCreated, WorkflowStarted, AgentStateChanged, ApprovalRequested

---

## 2. Entities

Entities are the core domain objects with unique identity and lifecycle management.

### 2.1 Agent (Aggregate Root)

**Purpose**: Represents an autonomous AI agent with specific role and capabilities.

**Identity**: Unique UUID persisted in database

**Attributes**:
- `id: string` - Unique identifier
- `role: AgentRole` - Agent role (CEO, PM, DEV, QA, MARKETING, BA, ARCHITECT, DEVOPS)
- `name: string` - Human-readable agent name
- `systemPrompt: string` - LLM system prompt defining agent behavior
- `modelRouteConfig: ModelRouteConfig` - LLM provider configuration
- `isActive: boolean` - Whether agent is currently active
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

**Behaviors**:
- `execute(context: AgentContext): Promise<AgentResult>` - Execute think-act cycle
- `think(context: AgentContext): Promise<AgentThought>` - Analyze and plan
- `act(thought: AgentThought): Promise<AgentActionResult>` - Execute actions
- `addEventListener(observer: IAgentObserver): void` - Register event observer
- `removeEventListener(observer: IAgentObserver): void` - Unregister observer
- `transitionState(newState: AgentState): void` - Change agent state

**Invariants**:
1. Agent role must be unique across all agents (Req 17.1)
2. Agent must have valid system prompt and model configuration
3. Agent can only be in one state at a time
4. State transitions must follow valid state machine rules

**Design Patterns Applied**:
- **Strategy Pattern**: ThinkingStrategy and ActionStrategy for behavioral flexibility
- **State Pattern**: AgentStateMachine for lifecycle management
- **Observer Pattern**: Event emission for decoupled notifications

---

### 2.2 Project (Aggregate Root)

**Purpose**: Represents a business project managed by the multi-agent system.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `name: string` - Project name
- `description: string` - Detailed project description
- `goal: string` - Strategic business goal
- `status: ProjectStatus` - Project status (active, paused, completed, cancelled)
- `budget: Money?` - Optional project budget
- `costAccrued: Money` - Total cost accumulated
- `createdById: string` - User who created project
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

**Behaviors**:
- `addMilestone(milestone: Milestone): void` - Add milestone to project
- `removeMilestone(milestoneId: string): void` - Remove milestone
- `addTask(task: Task): void` - Add task to project
- `updateStatus(status: ProjectStatus): void` - Change project status
- `calculateProgress(): number` - Calculate completion percentage
- `validateBudget(): boolean` - Validate cost doesn't exceed budget

**Invariants**:
1. Project must have name, description, and goal
2. Budget must be positive when provided (Req 17.2)
3. Cost accrued cannot exceed budget (when budget is set)
4. Project can only transition to valid next states
5. Cannot delete project with active workflows

**Aggregate Relationships**:
- **Contains**: Milestone (0..*), Task (0..*)
- **References**: User (created by)
- **Associated**: WorkflowRun (0..*)

---

### 2.3 WorkflowRun (Aggregate Root)

**Purpose**: Represents an instance of workflow execution orchestrating multiple agents.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string` - Associated project
- `workflowDefId: string` - Workflow definition ID
- `status: WorkflowStatus` - Execution status (running, paused, completed, failed, cancelled)
- `currentNodeId: string?` - Current execution node
- `context: JSON` - Workflow execution context
- `startedAt: DateTime` - Start timestamp
- `completedAt: DateTime?` - Completion timestamp

**Behaviors**:
- `start(): void` - Start workflow execution
- `pause(): void` - Pause execution
- `resume(): void` - Resume execution
- `cancel(): void` - Cancel workflow
- `complete(): void` - Mark as completed
- `fail(error: Error): void` - Mark as failed
- `executeStep(nodeId: string): Promise<void>` - Execute workflow step
- `requestApproval(approvalData: ApprovalData): Promise<Approval>` - Request human approval

**Invariants**:
1. Workflow must be associated with valid project
2. Status transitions must be valid (running→paused, running→completed, etc.)
3. Cannot resume workflow that isn't paused
4. CompletedAt must be after startedAt when both are set
5. Cannot modify completed or failed workflows

**Aggregate Relationships**:
- **Contains**: WorkflowStep (1..*), Approval (0..*)
- **References**: Project

---

### 2.4 Task

**Purpose**: Represents a unit of work assigned to an agent, tracked on Kanban board.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string` - Parent project
- `milestoneId: string?` - Optional parent milestone
- `title: string` - Task title
- `description: string` - Detailed description
- `status: TaskStatus` - Current status (todo, in_progress, review, done)
- `priority: Priority` - Task priority (low, medium, high, critical)
- `assignedAgent: AgentRole?` - Assigned agent role
- `estimatedCost: Money?` - Estimated completion cost
- `actualCost: Money` - Actual cost incurred
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

**Behaviors**:
- `assignToAgent(role: AgentRole): void` - Assign task to agent
- `updateStatus(newStatus: TaskStatus): void` - Update status
- `transitionStatus(newStatus: TaskStatus): void` - Validate and transition status
- `recordCost(cost: Money): void` - Record cost

**Invariants**:
1. Task must belong to valid project
2. Status transitions must follow Kanban rules (Req 12, 17):
   - `todo → in_progress → review → done`
   - Direct `todo → done` allowed
   - Cannot transition backwards (except review → in_progress for rework)
3. Estimated cost must be non-negative when provided
4. Actual cost cannot be negative

---

### 2.5 Milestone

**Purpose**: Represents a project milestone grouping related tasks.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string` - Parent project
- `name: string` - Milestone name
- `description: string` - Description
- `status: MilestoneStatus` - Status (pending, in_progress, completed)
- `dueDate: DateTime?` - Optional due date
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

**Behaviors**:
- `addTask(task: Task): void` - Add task to milestone
- `updateStatus(status: MilestoneStatus): void` - Update status
- `calculateProgress(): number` - Calculate completion percentage
- `isOverdue(): boolean` - Check if past due date

**Invariants**:
1. Milestone must belong to valid project
2. Due date must be in future when created
3. Cannot complete milestone with incomplete tasks
4. Status transitions: pending → in_progress → completed

---

### 2.6 Approval

**Purpose**: Represents human approval request in workflow execution.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `workflowRunId: string` - Parent workflow
- `userId: string` - User who must approve
- `approvalType: string` - Type of approval requested
- `status: ApprovalStatus` - Status (pending, approved, rejected)
- `requestData: JSON` - Data for approval decision
- `comment: string?` - Optional approver comment
- `requestedAt: DateTime` - Request timestamp
- `respondedAt: DateTime?` - Response timestamp

**Behaviors**:
- `approve(userId: string, comment?: string): void` - Approve request
- `reject(userId: string, reason: string): void` - Reject request
- `isExpired(): boolean` - Check if approval expired

**Invariants**:
1. Approval status can only transition pending → approved OR pending → rejected (Req 17.7)
2. Cannot change status after approval/rejection
3. RespondedAt must be after requestedAt when set
4. Only assigned user can approve/reject

---

### 2.7 AgentMemory

**Purpose**: Represents agent's long-term memory with vector embeddings for semantic search.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `agentId: string` - Owner agent
- `agentRole: AgentRole` - Agent role
- `namespace: string` - Memory category (e.g., "coding_conventions", "lessons_learned")
- `content: string` - Memory content
- `embedding: float[]?` - Vector embedding for semantic search
- `importance: number` - Importance score (1-10)
- `metadata: JSON` - Additional metadata (projectId, tags, etc.)
- `createdAt: DateTime` - Creation timestamp

**Behaviors**:
- `generateEmbedding(): Promise<float[]>` - Generate vector embedding
- `calculateRelevance(query: string): number` - Calculate relevance score

**Invariants**:
1. Memory must belong to valid agent
2. Importance must be between 1 and 10 inclusive (Req 17.3)
3. Namespace must be non-empty
4. Content must be non-empty

---

### 2.8 AgentMessage

**Purpose**: Represents inter-agent communication message in meeting room.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string` - Associated project
- `fromAgentId: string` - Sender agent
- `fromRole: AgentRole` - Sender role
- `toRole: AgentRole?` - Recipient role (null = broadcast)
- `message: string` - Message content
- `messageType: MessageType` - Type (chat, thinking, action, notification)
- `metadata: JSON?` - Additional metadata
- `createdAt: DateTime` - Creation timestamp

**Behaviors**:
- `isBroadcast(): boolean` - Check if message is broadcast
- `isDirectMessage(): boolean` - Check if message is direct

**Invariants**:
1. Message must have valid sender and project
2. Message content must be non-empty
3. Cannot send message to same role as sender

---

### 2.9 WorkflowStep

**Purpose**: Represents a single step in workflow execution.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `workflowRunId: string` - Parent workflow
- `taskId: string?` - Associated task
- `nodeId: string` - Workflow node ID
- `agentRole: AgentRole?` - Executing agent
- `status: StepStatus` - Status (pending, running, completed, failed, skipped)
- `input: JSON?` - Step input data
- `output: JSON?` - Step output data
- `error: string?` - Error message if failed
- `retryCount: number` - Number of retries
- `startedAt: DateTime?` - Start timestamp
- `completedAt: DateTime?` - Completion timestamp
- `durationMs: number?` - Execution duration

**Behaviors**:
- `start(): void` - Start step execution
- `complete(output: JSON): void` - Mark as completed
- `fail(error: Error): void` - Mark as failed
- `retry(): void` - Increment retry count

**Invariants**:
1. Step must belong to valid workflow run
2. CompletedAt must be after startedAt when both are set (Req 17.6)
3. Duration must match startedAt and completedAt when all are set
4. Cannot retry after max retry limit

---

### 2.10 ApiUsageLog

**Purpose**: Tracks LLM API usage for cost monitoring and optimization.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string?` - Associated project
- `agentRole: AgentRole` - Agent that made request
- `requestedModel: string` - Model requested
- `actualModelUsed: string` - Model actually used
- `actualProvider: string` - Provider that handled request
- `isFallbackTriggered: boolean` - Whether fallback was used
- `promptTokens: number` - Input token count
- `completionTokens: number` - Output token count
- `totalTokens: number` - Total tokens
- `rtkTokenSaved: number?` - Tokens saved by RTK compression
- `estimatedCost: Money` - Cost from requested model pricing
- `actualCost: Money` - Cost from actual model pricing
- `responseTimeMs: number` - Response latency
- `createdAt: DateTime` - Log timestamp

**Behaviors**:
- `calculateCost(): Money` - Calculate API call cost
- `calculateSavings(): Money` - Calculate savings from fallback/RTK

**Invariants**:
1. Total tokens must equal promptTokens + completionTokens
2. RTK tokens saved must be non-negative and <= promptTokens
3. Response time must be positive
4. Token counts must be non-negative

---

### 2.11 LLMGatewayStatus

**Purpose**: Tracks LLM gateway health and circuit breaker status.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `gatewayName: string` - Gateway identifier (unique)
- `status: GatewayStatus` - Health status (online, offline, degraded)
- `lastHealthCheck: DateTime` - Last health check timestamp
- `consecutiveFailures: number` - Failure counter
- `metadata: JSON?` - Health metrics
- `updatedAt: DateTime` - Last update timestamp

**Behaviors**:
- `recordSuccess(): void` - Reset failure counter
- `recordFailure(): void` - Increment failure counter
- `shouldTriggerCircuitBreaker(): boolean` - Check if threshold reached (3 failures)
- `updateHealthStatus(status: GatewayStatus): void` - Update status

**Invariants**:
1. Gateway name must be unique
2. Consecutive failures must be non-negative
3. Circuit breaker triggers at 3 consecutive failures

---

### 2.12 User

**Purpose**: Represents human user with authentication and authorization.

**Identity**: Unique UUID

**Attributes**:
- `id: string` - Unique identifier
- `email: string` - User email (unique)
- `name: string` - User name
- `role: string` - User role (board_member, admin, etc.)
- `passwordHash: string` - Hashed password
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

**Behaviors**:
- `authenticate(password: string): boolean` - Verify password
- `updatePassword(newPassword: string): void` - Update password
- `hasPermission(permission: string): boolean` - Check permission

**Invariants**:
1. Email must be unique and valid format
2. Password must meet security requirements (hashed)
3. Role must be valid system role

---

### 2.13 NEW Entities for Extended Features

#### 2.13.1 BARequirementSpec

**Purpose**: Business Analyst's requirements specification document.

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string` - Associated project
- `title: string` - Specification title
- `functionalRequirements: Requirement[]` - Functional requirements
- `nonFunctionalRequirements: Requirement[]` - NFRs
- `useCases: UseCase[]` - Use case descriptions
- `acceptanceCriteria: Criterion[]` - Acceptance criteria
- `createdById: string` - BA agent ID
- `status: DocumentStatus` - Status (draft, review, approved)
- `version: string` - Document version
- `createdAt: DateTime`
- `updatedAt: DateTime`

**Invariants**:
1. Must have at least one functional requirement
2. All requirements must have unique IDs
3. Use cases must reference valid requirements

---

#### 2.13.2 ArchitectureDocument

**Purpose**: Software Architect's design documentation.

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string` - Associated project
- `title: string` - Document title
- `architectureStyle: string` - Architecture pattern (layered, microservices, etc.)
- `componentDiagrams: Diagram[]` - Component diagrams
- `designPatterns: Pattern[]` - Applied design patterns
- `technologyStack: Technology[]` - Technology choices
- `qualityAttributes: Attribute[]` - Quality attribute scenarios
- `createdById: string` - Architect agent ID
- `status: DocumentStatus` - Status
- `version: string` - Document version
- `createdAt: DateTime`
- `updatedAt: DateTime`

**Invariants**:
1. Must specify architecture style
2. Must document at least one quality attribute
3. Technology stack must be compatible

---

#### 2.13.3 DeploymentJob

**Purpose**: DevOps deployment job execution tracking.

**Attributes**:
- `id: string` - Unique identifier
- `projectId: string` - Associated project
- `environment: string` - Target environment (dev, staging, prod)
- `deploymentType: string` - Type (full, incremental, rollback)
- `status: JobStatus` - Status (pending, running, success, failed)
- `triggeredBy: string` - DevOps agent ID
- `artifacts: Artifact[]` - Deployed artifacts
- `logs: string` - Deployment logs
- `startedAt: DateTime`
- `completedAt: DateTime?`
- `rollbackJobId: string?` - Rollback job reference

**Invariants**:
1. Cannot deploy to production without approval
2. Must have valid artifacts
3. Rollback must reference valid previous deployment

---

## 3. Value Objects

Value objects are immutable objects defined by their attributes rather than identity.

### 3.1 AgentRole (Enum)

**Purpose**: Represents agent's functional role in organization.

**Values**:
- `CEO` - Chief Executive Officer (strategic planning, delegation)
- `PM` - Project Manager (task breakdown, coordination)
- `DEV` - Developer (code implementation)
- `QA` - Quality Assurance (testing, verification)
- `MARKETING` - Marketing Specialist (campaigns, content)
- `BA` - Business Analyst (requirements, specifications)
- `ARCHITECT` - Software Architect (design, patterns)
- `DEVOPS` - DevOps Engineer (deployment, infrastructure)

**Characteristics**:
- Immutable
- Value equality
- Self-validating (only valid values allowed)

---

### 3.2 TaskStatus (Enum)

**Purpose**: Represents task position in Kanban workflow.

**Values**:
- `todo` - Task not started
- `in_progress` - Task being worked on
- `review` - Task awaiting review
- `done` - Task completed

**Valid Transitions** (Req 12, 17):
- `todo → in_progress`
- `in_progress → review`
- `review → done`
- `review → in_progress` (rework)
- `todo → done` (simple tasks)

---

### 3.3 WorkflowStatus (Enum)

**Purpose**: Represents workflow execution state.

**Values**:
- `running` - Workflow actively executing
- `paused` - Workflow paused awaiting input
- `completed` - Workflow successfully completed
- `failed` - Workflow failed with error
- `cancelled` - Workflow manually cancelled

---

### 3.4 AgentState (Enum)

**Purpose**: Represents agent's current state in execution lifecycle.

**Values**:
- `IDLE` - Agent waiting for work
- `THINKING` - Agent analyzing and planning
- `ACTING` - Agent executing actions
- `WAITING_APPROVAL` - Agent awaiting human approval
- `ERROR` - Agent encountered error
- `COMPLETED` - Agent completed task

**Valid Transitions**:
- `IDLE → THINKING`
- `THINKING → ACTING | ERROR`
- `ACTING → COMPLETED | WAITING_APPROVAL | ERROR`
- `WAITING_APPROVAL → ACTING | COMPLETED | ERROR`
- `ERROR → IDLE` (recovery)
- `COMPLETED → IDLE` (reuse)

---

### 3.5 Money

**Purpose**: Represents monetary value with currency.

**Attributes**:
- `amount: Decimal` - Monetary amount
- `currency: string` - Currency code (USD, EUR, etc.)

**Behaviors**:
- `add(other: Money): Money` - Add two monetary values
- `subtract(other: Money): Money` - Subtract monetary value
- `multiply(factor: number): Money` - Multiply amount
- `equals(other: Money): boolean` - Value equality
- `format(): string` - Format for display

**Invariants**:
1. Amount must be non-negative for budgets/costs
2. Currency must be valid ISO code
3. Cannot add/subtract different currencies without conversion

---

### 3.6 TimeRange

**Purpose**: Represents time period with start and end.

**Attributes**:
- `start: DateTime` - Start timestamp
- `end: DateTime` - End timestamp
- `duration: number` - Duration in milliseconds

**Behaviors**:
- `getDuration(): number` - Calculate duration
- `contains(timestamp: DateTime): boolean` - Check if timestamp in range
- `overlaps(other: TimeRange): boolean` - Check overlap

**Invariants**:
1. End must be after start
2. Duration must match start and end

---

### 3.7 AgentCapability

**Purpose**: Represents set of tools agent can use.

**Attributes**:
- `tools: Set<string>` - Tool names

**Behaviors**:
- `canExecute(toolName: string): boolean` - Check if tool available
- `addTool(toolName: string): AgentCapability` - Add tool (returns new instance)
- `removeTool(toolName: string): AgentCapability` - Remove tool

**Invariants**:
1. Tool names must be valid
2. Cannot have duplicate tools

---

### 3.8 ProjectStatus (Enum)

**Purpose**: Represents project lifecycle status.

**Values**:
- `active` - Project actively being worked on
- `paused` - Project temporarily paused
- `completed` - Project successfully completed
- `cancelled` - Project cancelled

---

### 3.9 ModelRouteConfig

**Purpose**: Configures LLM provider routing for agent.

**Attributes**:
- `provider: string` - Primary provider (e.g., "ninerouter")
- `model: string` - Model identifier (e.g., "claude-3-sonnet")
- `fallbackProvider: string?` - Fallback provider
- `tags: string[]` - Model tags for routing

**Behaviors**:
- `equals(other: ModelRouteConfig): boolean` - Value equality
- `validate(): boolean` - Validate configuration

**Invariants**:
1. Provider and model must be non-empty
2. Fallback provider must differ from primary

---

## 4. Aggregates and Aggregate Roots

Aggregates are clusters of entities and value objects forming consistency boundaries.

### 4.1 Project Aggregate

**Aggregate Root**: Project

**Contained Entities**:
- Milestone (0..*)
- Task (0..*)

**Consistency Boundary**:
- All milestones and tasks belong to exactly one project
- Project status reflects milestone/task states
- Budget tracking spans all tasks
- Lifecycle: Creating/deleting project affects all children

**Business Rules Enforced**:
1. Cannot delete project with active tasks
2. Project completion requires all milestones completed
3. Cost accrued is sum of all task costs
4. Budget cannot be negative
5. Milestone due dates must be within project timeline

**Access Pattern**:
- External access via Project root only
- Milestones/Tasks accessed through Project
- Repository pattern for persistence

---

### 4.2 Workflow Aggregate

**Aggregate Root**: WorkflowRun

**Contained Entities**:
- WorkflowStep (1..*)
- Approval (0..*)

**Consistency Boundary**:
- All steps belong to exactly one workflow run
- Workflow status reflects step states
- Approval requests tied to workflow execution
- Cannot modify completed/failed workflows

**Business Rules Enforced**:
1. Steps execute in defined order
2. Approval must be resolved before workflow continues
3. Failed step can trigger workflow failure
4. All steps must complete for workflow completion
5. Cannot skip non-optional steps

**Access Pattern**:
- External access via WorkflowRun root
- Steps and approvals accessed through WorkflowRun
- Workflow engine orchestrates execution

---

### 4.3 Agent Aggregate

**Aggregate Root**: Agent

**Contained Entities**:
- AgentMemory (0..*)
- AgentMessage (0..*)

**Consistency Boundary**:
- All memories belong to exactly one agent
- Messages sent by one agent
- Agent role is unique identifier
- State machine ensures valid state transitions

**Business Rules Enforced**:
1. Agent can only be in one state at a time
2. State transitions must follow state machine rules
3. Memories categorized by namespace
4. Only active agents can execute tasks
5. Agent configuration must be valid

**Access Pattern**:
- External access via Agent root
- Memories accessed through agent for semantic search
- Messages created and sent by agent

---

## 5. Repositories

Repositories provide collection-like interface for accessing aggregates.

### 5.1 IAgentRepository

**Purpose**: Manage agent aggregate persistence.

**Interface**:
```typescript
interface IAgentRepository {
  findById(id: string): Promise<Agent | null>;
  findByRole(role: AgentRole): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  findActive(): Promise<Agent[]>;
  save(agent: Agent): Promise<Agent>;
  update(agent: Agent): Promise<Agent>;
  delete(id: string): Promise<void>;
  // Memory operations
  saveMemory(memory: AgentMemory): Promise<void>;
  findMemories(agentId: string, namespace: string): Promise<AgentMemory[]>;
  searchMemoriesByEmbedding(agentId: string, query: string, limit: number): Promise<AgentMemory[]>;
}
```

**Design Principles**:
- Collection-oriented interface
- Returns aggregates, not individual entities
- Hides persistence technology (Prisma)
- Domain-focused API

---

### 5.2 IProjectRepository

**Purpose**: Manage project aggregate persistence.

**Interface**:
```typescript
interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByUser(userId: string): Promise<Project[]>;
  findActive(): Promise<Project[]>;
  save(project: Project): Promise<Project>;
  update(project: Project): Promise<Project>;
  delete(id: string): Promise<void>;
  // Aggregate navigation
  findMilestones(projectId: string): Promise<Milestone[]>;
  findTasks(projectId: string): Promise<Task[]>;
  findTasksByStatus(projectId: string, status: TaskStatus): Promise<Task[]>;
  calculateTotalCost(projectId: string): Promise<Money>;
}
```

---

### 5.3 IWorkflowRepository

**Purpose**: Manage workflow aggregate persistence.

**Interface**:
```typescript
interface IWorkflowRepository {
  findById(id: string): Promise<WorkflowRun | null>;
  findByProject(projectId: string): Promise<WorkflowRun[]>;
  findByStatus(status: WorkflowStatus): Promise<WorkflowRun[]>;
  save(workflow: WorkflowRun): Promise<WorkflowRun>;
  update(workflow: WorkflowRun): Promise<WorkflowRun>;
  delete(id: string): Promise<void>;
  // Step operations
  findSteps(workflowRunId: string): Promise<WorkflowStep[]>;
  findPendingApprovals(workflowRunId: string): Promise<Approval[]>;
}
```

---

### 5.4 ITaskRepository

**Purpose**: Manage task persistence within project aggregate.

**Interface**:
```typescript
interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProject(projectId: string): Promise<Task[]>;
  findByStatus(projectId: string, status: TaskStatus): Promise<Task[]>;
  findByAgent(agentRole: AgentRole): Promise<Task[]>;
  save(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
  delete(id: string): Promise<void>;
  updateStatus(taskId: string, status: TaskStatus): Promise<void>;
}
```

---

### 5.5 IApprovalRepository

**Purpose**: Manage approval requests in workflow aggregate.

**Interface**:
```typescript
interface IApprovalRepository {
  findById(id: string): Promise<Approval | null>;
  findByWorkflow(workflowRunId: string): Promise<Approval[]>;
  findByUser(userId: string): Promise<Approval[]>;
  findPending(userId: string): Promise<Approval[]>;
  save(approval: Approval): Promise<Approval>;
  update(approval: Approval): Promise<Approval>;
  approve(approvalId: string, userId: string, comment?: string): Promise<void>;
  reject(approvalId: string, userId: string, reason: string): Promise<void>;
}
```

---

### 5.6 IMemoryRepository

**Purpose**: Manage agent memory with vector search capabilities.

**Interface**:
```typescript
interface IMemoryRepository {
  save(memory: AgentMemory): Promise<string>;
  findById(id: string): Promise<AgentMemory | null>;
  findByAgent(agentId: string, namespace?: string): Promise<AgentMemory[]>;
  searchSemantic(agentRole: AgentRole, namespace: string, query: string, limit: number): Promise<AgentMemory[]>;
  delete(id: string): Promise<void>;
  deleteByAgent(agentId: string): Promise<void>;
}
```

**Special Features**:
- Vector embedding storage
- Semantic similarity search
- Namespace filtering
- Importance-weighted retrieval

---

## 6. Domain Events

Domain events represent significant occurrences that domain experts care about.

### 6.1 Project Domain Events

#### ProjectCreated
```typescript
{
  eventId: string;
  eventType: 'ProjectCreated';
  projectId: string;
  projectName: string;
  createdBy: string;
  timestamp: DateTime;
  metadata: {
    goal: string;
    budget?: Money;
  };
}
```

#### ProjectStatusChanged
```typescript
{
  eventId: string;
  eventType: 'ProjectStatusChanged';
  projectId: string;
  previousStatus: ProjectStatus;
  newStatus: ProjectStatus;
  reason?: string;
  timestamp: DateTime;
}
```

#### MilestoneCreated
```typescript
{
  eventId: string;
  eventType: 'MilestoneCreated';
  milestoneId: string;
  projectId: string;
  milestoneName: string;
  dueDate?: DateTime;
  timestamp: DateTime;
}
```

---

### 6.2 Workflow Domain Events

#### WorkflowStarted
```typescript
{
  eventId: string;
  eventType: 'WorkflowStarted';
  workflowRunId: string;
  projectId: string;
  workflowDefId: string;
  timestamp: DateTime;
}
```

#### WorkflowStepCompleted
```typescript
{
  eventId: string;
  eventType: 'WorkflowStepCompleted';
  workflowRunId: string;
  stepId: string;
  nodeId: string;
  agentRole?: AgentRole;
  output: JSON;
  durationMs: number;
  timestamp: DateTime;
}
```

#### WorkflowCompleted
```typescript
{
  eventId: string;
  eventType: 'WorkflowCompleted';
  workflowRunId: string;
  projectId: string;
  totalDurationMs: number;
  totalSteps: number;
  timestamp: DateTime;
}
```

#### WorkflowFailed
```typescript
{
  eventId: string;
  eventType: 'WorkflowFailed';
  workflowRunId: string;
  projectId: string;
  failedStepId: string;
  error: string;
  timestamp: DateTime;
}
```

---

### 6.3 Approval Domain Events

#### ApprovalRequested
```typescript
{
  eventId: string;
  eventType: 'ApprovalRequested';
  approvalId: string;
  workflowRunId: string;
  userId: string;
  approvalType: string;
  requestData: JSON;
  timestamp: DateTime;
}
```

#### ApprovalGranted
```typescript
{
  eventId: string;
  eventType: 'ApprovalGranted';
  approvalId: string;
  workflowRunId: string;
  approvedBy: string;
  comment?: string;
  timestamp: DateTime;
}
```

#### ApprovalRejected
```typescript
{
  eventId: string;
  eventType: 'ApprovalRejected';
  approvalId: string;
  workflowRunId: string;
  rejectedBy: string;
  reason: string;
  timestamp: DateTime;
}
```

---

### 6.4 Agent Domain Events

#### AgentStateChanged
```typescript
{
  eventId: string;
  eventType: 'AgentStateChanged';
  agentId: string;
  agentRole: AgentRole;
  previousState: AgentState;
  currentState: AgentState;
  reason?: string;
  timestamp: DateTime;
}
```

#### AgentThinkingCompleted
```typescript
{
  eventId: string;
  eventType: 'AgentThinkingCompleted';
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  thought: AgentThought;
  confidence: number;
  timestamp: DateTime;
}
```

#### AgentActionCompleted
```typescript
{
  eventId: string;
  eventType: 'AgentActionCompleted';
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  actionType: string;
  toolName: string;
  success: boolean;
  timestamp: DateTime;
}
```

---

### 6.5 Task Domain Events

#### TaskCreated
```typescript
{
  eventId: string;
  eventType: 'TaskCreated';
  taskId: string;
  projectId: string;
  title: string;
  assignedAgent?: AgentRole;
  priority: Priority;
  timestamp: DateTime;
}
```

#### TaskStatusChanged
```typescript
{
  eventId: string;
  eventType: 'TaskStatusChanged';
  taskId: string;
  projectId: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  changedBy: string;
  timestamp: DateTime;
}
```

#### TaskAssigned
```typescript
{
  eventId: string;
  eventType: 'TaskAssigned';
  taskId: string;
  projectId: string;
  agentRole: AgentRole;
  timestamp: DateTime;
}
```

---

## 7. Business Rules & Invariants

Comprehensive list of business rules extracted from codebase and requirements.

### 7.1 Agent Rules

**Rule 1**: Each agent role must be unique across all agents (Requirement 17.1).
- **Enforcement**: Database unique constraint + repository validation
- **Rationale**: Ensures single agent per role for clear responsibility

**Rule 2**: Agent can only be in one state at a time.
- **Enforcement**: AgentStateMachine class
- **Rationale**: Prevents conflicting behavior and ensures predictable lifecycle

**Rule 3**: State transitions must follow valid state machine paths.
- **Enforcement**: AgentStateMachine.transitionTo() validates transitions
- **Valid Paths**: See AgentState value object section
- **Rationale**: Enforces logical execution flow

**Rule 4**: Agent cannot execute tasks while in ERROR or COMPLETED state.
- **Enforcement**: Agent.execute() checks current state
- **Rationale**: Ensures agent is ready for work

**Rule 5**: Only active agents can be assigned tasks.
- **Enforcement**: TaskService validates agent.isActive before assignment
- **Rationale**: Prevents assignment to deactivated agents

---

### 7.2 Project Rules

**Rule 6**: Project budget must be positive when provided (Requirement 17.2).
- **Enforcement**: ProjectController validates on creation/update
- **Rationale**: Negative budgets are nonsensical

**Rule 7**: Cost accrued cannot exceed budget when budget is set.
- **Enforcement**: Project.recordCost() validates before updating
- **Rationale**: Prevents over-budget spending without approval

**Rule 8**: Project cannot be deleted if it has active workflow runs.
- **Enforcement**: ProjectService checks active workflows before deletion
- **Rationale**: Prevents data inconsistency and orphaned workflows

**Rule 9**: Project completion requires all milestones to be completed.
- **Enforcement**: ProjectService.completeProject() validates milestones
- **Rationale**: Ensures all objectives met before marking complete

---

### 7.3 Task Rules (Kanban)

**Rule 10**: Task status transitions must follow Kanban workflow (Requirement 12, 17).
- **Valid Transitions**:
  - todo → in_progress
  - in_progress → review
  - review → done
  - review → in_progress (rework)
  - todo → done (simple tasks)
- **Enforcement**: TaskService.updateStatus() validates transitions
- **Rationale**: Enforces structured workflow and quality gates

**Rule 11**: Task cannot be moved to done without completing required fields.
- **Enforcement**: Task.validate() checks completeness
- **Rationale**: Ensures task is properly documented

**Rule 12**: High-priority tasks should be worked on before low-priority tasks.
- **Enforcement**: Application logic (not hard constraint)
- **Rationale**: Ensures important work is prioritized

---

### 7.4 Workflow Rules

**Rule 13**: Workflow steps must execute in order defined by workflow definition.
- **Enforcement**: WorkflowEngine respects node dependencies
- **Rationale**: Ensures logical execution flow

**Rule 14**: Workflow cannot proceed past approval step until approval granted.
- **Enforcement**: WorkflowEngine pauses at approval nodes
- **Rationale**: Ensures human oversight where required

**Rule 15**: Failed workflow step can be retried up to maximum retry limit.
- **Enforcement**: WorkflowStep.retryCount checked before retry
- **Rationale**: Prevents infinite retry loops

**Rule 16**: Completed or failed workflows cannot be modified.
- **Enforcement**: WorkflowService checks status before updates
- **Rationale**: Ensures audit trail integrity

---

### 7.5 Approval Rules

**Rule 17**: Approval status can only transition pending → approved OR pending → rejected (Requirement 17.7).
- **Enforcement**: ApprovalService.updateStatus() validates transition
- **Rationale**: One-way transition ensures decision finality

**Rule 18**: Only assigned user can approve or reject approval request.
- **Enforcement**: ApprovalService checks userId matches approval.userId
- **Rationale**: Ensures proper authorization

**Rule 19**: Approval cannot be changed after response is recorded.
- **Enforcement**: ApprovalService checks if respondedAt is set
- **Rationale**: Prevents tampering with approval history

---

### 7.6 Memory Rules

**Rule 20**: Memory importance must be between 1 and 10 inclusive (Requirement 17.3).
- **Enforcement**: MemoryService validates importance parameter
- **Rationale**: Standardizes importance scale for consistent retrieval

**Rule 21**: Memories with higher importance are prioritized in retrieval.
- **Enforcement**: MemoryService.searchMemories() sorts by importance
- **Rationale**: Ensures most relevant memories retrieved first

---

### 7.7 Timestamp Rules

**Rule 22**: completedAt must be after startedAt when both are set (Requirement 17.6).
- **Enforcement**: Validated in WorkflowService and TaskService
- **Rationale**: Logical time ordering

**Rule 23**: respondedAt must be after requestedAt for approvals.
- **Enforcement**: ApprovalService validates timestamps
- **Rationale**: Logical time ordering

---

### 7.8 Cost Tracking Rules

**Rule 24**: Total tokens must equal promptTokens + completionTokens in API logs.
- **Enforcement**: ApiUsageService validates before saving
- **Rationale**: Ensures accurate cost calculation

**Rule 25**: RTK tokens saved must be non-negative and <= promptTokens.
- **Enforcement**: ApiUsageService validates RTK parameter
- **Rationale**: Tokens saved cannot exceed prompt tokens

**Rule 26**: Actual cost is calculated from actual model used, not requested model.
- **Enforcement**: ApiUsageService uses actualModelUsed for pricing
- **Rationale**: Accurate cost tracking when fallback occurs

---

### 7.9 Circuit Breaker Rules

**Rule 27**: Circuit breaker triggers after 3 consecutive LLM gateway failures.
- **Enforcement**: LLMGatewayStatus.consecutiveFailures threshold check
- **Rationale**: Prevents cascading failures

**Rule 28**: Circuit breaker resets after successful health check.
- **Enforcement**: LLMGatewayStatus.recordSuccess() resets counter
- **Rationale**: Allows recovery after issues resolved

---

### 7.10 Security Rules

**Rule 29**: All user inputs must be sanitized before LLM calls.
- **Enforcement**: sanitizeUserInput() called in BaseAgent.callLLM()
- **Rationale**: Prevents prompt injection attacks

**Rule 30**: Tool parameters must be validated against schema before execution.
- **Enforcement**: validateParameters() in BaseAgent.executeTool()
- **Rationale**: Prevents malicious or malformed tool invocations

---

## 8. Conclusion

This domain model provides a comprehensive conceptual foundation for the AI-CORP multi-agent platform. It captures:

- **50+ domain entities** with clear identities, attributes, behaviors, and invariants
- **9 value objects** representing immutable domain concepts
- **3 core aggregates** enforcing consistency boundaries
- **6 repository interfaces** abstracting persistence
- **25+ domain events** enabling loose coupling
- **30+ business rules** ensuring system integrity

The model applies rigorous DDD principles and serves as the authoritative reference for:
- Development team implementing features
- QA team writing tests
- Architects making design decisions
- Business stakeholders validating requirements
- Documentation team creating user guides

This domain model will evolve as requirements change, but the core principles—entities, value objects, aggregates, events—remain constant.

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: After Phase 1 Implementation
