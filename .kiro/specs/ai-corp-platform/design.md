# Design Document: AI Corp Platform

## Overview

AI Corp is a web-based platform that simulates a "virtual tech company" where all employees are AI Agents powered by Large Language Models. The platform automates the complete software development lifecycle: receiving requirements → planning → task breakdown → code implementation → QA review → release → marketing content creation. Human users act as the "Board of Directors," providing initial goals, approving milestones, and intervening when agents encounter challenges (human-in-the-loop pattern).

The system is designed for founders, product managers, and technical leaders who want to rapidly prototype product ideas using an autonomous "virtual company" of AI agents. It serves as both a technology demonstration and an internal development tool, showcasing advanced multi-agent orchestration, real-time collaboration, and intelligent task automation.

**Key Innovation**: Integration of 9Router as an LLM gateway providing 3-tier auto-fallback (subscription APIs → cheap APIs → free providers) with RTK Token Saver technology that reduces input tokens by 20-40% through intelligent compression of tool-call outputs.

## Architecture

### System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React + Vite + TypeScript]
        UI --> |WebSocket| WS[WebSocket Client]
        UI --> |HTTP/SSE| HTTP[HTTP Client]
    end
    
    subgraph "Backend Layer - NestJS"
        API[API Gateway Module]
        WS_SERVER[WebSocket Server Module]
        AGENT_ORCHESTRATOR[Agent Orchestrator Module]
        LLM_GATEWAY[LLM Gateway Module]
        
        API --> AGENT_ORCHESTRATOR
        WS_SERVER --> AGENT_ORCHESTRATOR
        AGENT_ORCHESTRATOR --> LLM_GATEWAY
    end
    
    subgraph "Agent Layer"
        CEO[CEO Agent]
        PM[PM Agent]
        DEV[Dev Agent]
        QA[QA Agent]
        MARKETING[Marketing Agent]
    end
    
    subgraph "External Services"
        NINEROUTER[9Router Gateway<br/>localhost:20128]
        ANTHROPIC[Anthropic Direct API]
        SANDBOX[Docker Sandbox<br/>Tool Execution]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL + pgvector)]
        REDIS[(Redis + BullMQ)]
    end
    
    AGENT_ORCHESTRATOR --> CEO
    AGENT_ORCHESTRATOR --> PM
    AGENT_ORCHESTRATOR --> DEV
    AGENT_ORCHESTRATOR --> QA
    AGENT_ORCHESTRATOR --> MARKETING
    
    LLM_GATEWAY --> NINEROUTER
    LLM_GATEWAY -.fallback.-> ANTHROPIC
    
    CEO --> PG
    PM --> PG
    DEV --> SANDBOX
    QA --> SANDBOX
    MARKETING --> PG
    
    AGENT_ORCHESTRATOR --> REDIS
    AGENT_ORCHESTRATOR --> PG
```


### Monorepo Structure

```
ai-corp/
├── apps/
│   ├── web/                    # Vite + React + TypeScript frontend
│   │   ├── src/
│   │   │   ├── components/     # Ant Design components
│   │   │   ├── stores/         # Zustand state management
│   │   │   ├── hooks/          # React Query hooks
│   │   │   ├── services/       # WebSocket & HTTP clients
│   │   │   └── pages/          # Dashboard, Virtual Office, Agent Detail
│   │   └── package.json
│   │
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── agents/     # Agent orchestration & execution
│       │   │   ├── workflows/  # DAG-based workflow engine
│       │   │   ├── llm/        # LLM provider abstraction & 9Router
│       │   │   ├── tools/      # Tool execution & sandbox management
│       │   │   ├── memory/     # Vector memory & embeddings
│       │   │   ├── tasks/      # Task queue & BullMQ
│       │   │   ├── websocket/  # Real-time communication
│       │   │   └── auth/       # Authentication & authorization
│       │   ├── prisma/
│       │   │   └── schema.prisma
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   ├── shared-types/           # TypeScript types shared across apps
│   │   ├── src/
│   │   │   ├── agent.types.ts
│   │   │   ├── task.types.ts
│   │   │   ├── workflow.types.ts
│   │   │   └── websocket.types.ts
│   │   └── package.json
│   │
│   └── config/                 # Shared configuration
│       ├── eslint-config/
│       ├── tsconfig/
│       └── prettier-config/
│
├── docker-compose.yml          # Postgres, Redis, 9Router
├── pnpm-workspace.yaml
├── package.json
└── turbo.json
```


### Main Workflow Sequence

```mermaid
sequenceDiagram
    participant Board as Board of Directors (Human)
    participant UI as Frontend UI
    participant Orch as Agent Orchestrator
    participant CEO as CEO Agent
    participant PM as PM Agent
    participant Dev as Dev Agent
    participant QA as QA Agent
    participant Marketing as Marketing Agent
    participant LLM as 9Router Gateway
    participant DB as Database
    
    Board->>UI: Submit Goal/Feature Request
    UI->>Orch: Create Project with Goal
    Orch->>DB: Save Project
    Orch->>CEO: Invoke planMilestones(goal)
    
    CEO->>LLM: Request analysis (claude-sonnet-4-6)
    LLM-->>CEO: Strategic plan
    CEO->>DB: Create Milestones
    CEO->>Orch: Milestones complete
    
    Orch->>PM: Invoke breakdownTasks(milestones)
    PM->>LLM: Request task breakdown
    LLM-->>PM: Task list
    PM->>DB: Create Tasks (Kanban)
    PM->>Orch: Tasks ready
    
    loop For each task
        Orch->>Dev: Invoke implement(task)
        Dev->>LLM: Request code solution
        LLM-->>Dev: Code implementation
        Dev->>Dev: Execute write_file tool
        Dev->>Dev: Execute run_tests tool
        Dev->>DB: Update Task status
        
        Orch->>QA: Invoke review(task)
        QA->>LLM: Request code review
        LLM-->>QA: Review feedback
        
        alt Review fails
            QA->>DB: Create review comments
            QA->>Orch: Request changes
            Orch->>Dev: Rework task
        else Review passes
            QA->>DB: Approve task
            QA->>Orch: Task complete
        end
    end
    
    Orch->>Marketing: Invoke draftAnnouncement(project)
    Marketing->>LLM: Generate content
    LLM-->>Marketing: Marketing draft
    Marketing->>DB: Save draft
    
    Orch->>Board: Request approval
    Board->>UI: Review & approve
    UI->>Orch: Approval granted
    Orch->>DB: Mark project complete
```


## Components and Interfaces

### 1. Agent Layer - Base Agent Class

**Purpose**: Abstract base class providing common functionality for all AI agents including memory management, LLM interaction, and tool execution.

**Interface**:
```typescript
abstract class BaseAgent {
  protected agentId: string;
  protected role: AgentRole;
  protected systemPrompt: string;
  protected modelRouteConfig: ModelRouteConfig;
  protected memoryService: MemoryService;
  protected llmProvider: ILLMProvider;
  protected toolRegistry: ToolRegistry;
  
  // Core agent lifecycle methods
  abstract async think(context: AgentContext): Promise<AgentThought>;
  abstract async act(thought: AgentThought): Promise<AgentAction>;
  
  // Memory management
  async loadMemory(namespace: string, query: string): Promise<Memory[]>;
  async saveMemory(content: string, metadata: MemoryMetadata): Promise<void>;
  
  // LLM interaction
  protected async callLLM(messages: ChatMessage[]): Promise<ChatResult>;
  
  // Tool execution
  protected async executeTool(toolName: string, params: unknown): Promise<ToolResult>;
}
```

**Responsibilities**:
- Manage agent lifecycle (initialization, execution, cleanup)
- Load and save long-term memories using vector search
- Interact with LLM provider through abstraction layer
- Execute tools in sandboxed environment
- Log all actions and decisions to database
- Handle errors and retry logic


### 2. LLM Gateway Module

**Purpose**: Provide unified interface for interacting with multiple LLM providers, with 9Router as primary gateway and graceful fallback to direct provider APIs.

**Interface**:
```typescript
interface ILLMProvider {
  chat(params: ChatParams): Promise<ChatResult>;
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
}

interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

interface ChatResult {
  content: string;
  requestedModel: string;
  actualModelUsed: string;
  actualProvider: string;
  isFallbackTriggered: boolean;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rtkTokenSaved?: number;
  toolCalls?: ToolCall[];
}

class NineRouterProvider implements ILLMProvider {
  private baseURL: string;
  private apiKey: string;
  private openAIClient: OpenAI;
  
  async chat(params: ChatParams): Promise<ChatResult>;
  async validateConfig(): Promise<boolean>;
  getProviderName(): string;
}

class AnthropicDirectProvider implements ILLMProvider {
  private apiKey: string;
  private anthropicClient: Anthropic;
  
  async chat(params: ChatParams): Promise<ChatResult>;
  async validateConfig(): Promise<boolean>;
  getProviderName(): string;
}

class LLMProviderFactory {
  private healthService: NineRouterHealthService;
  
  getProvider(config: ModelRouteConfig): ILLMProvider;
}
```

**Responsibilities**:
- Route LLM requests to 9Router or direct provider based on health status
- Parse response to extract actual model and provider used (for accurate cost tracking)
- Handle provider-specific authentication and configuration
- Implement circuit breaker pattern for automatic fallback
- Log all LLM interactions with detailed metadata


### 3. Workflow Engine Module

**Purpose**: DAG-based orchestration engine that manages the flow of work between agents, handles state transitions, and implements human-in-the-loop approval points.

**Interface**:
```typescript
interface WorkflowNode {
  id: string;
  type: 'agent_task' | 'human_approval' | 'condition' | 'parallel';
  agentRole?: AgentRole;
  taskType?: string;
  conditions?: {
    onSuccess?: string;  // Next node ID
    onFail?: string;     // Next node ID
    onApprove?: string;  // For human approval nodes
    onReject?: string;
  };
  maxRetries?: number;
  timeout?: number;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNode: string;
  endNode: string;
}

class WorkflowEngine {
  private queue: BullQueue;
  private db: PrismaClient;
  
  async createWorkflow(definition: WorkflowDefinition): Promise<string>;
  async startWorkflow(workflowId: string, initialContext: unknown): Promise<string>;
  async resumeWorkflow(runId: string): Promise<void>;
  async pauseWorkflow(runId: string): Promise<void>;
  async cancelWorkflow(runId: string): Promise<void>;
  
  private async executeNode(node: WorkflowNode, context: WorkflowContext): Promise<NodeResult>;
  private async transitionToNextNode(currentNode: string, result: NodeResult): Promise<string | null>;
  private async saveWorkflowState(runId: string, state: WorkflowState): Promise<void>;
}

interface WorkflowContext {
  projectId: string;
  milestones?: Milestone[];
  tasks?: Task[];
  variables: Record<string, unknown>;
}

interface NodeResult {
  status: 'success' | 'failure' | 'pending_approval';
  output: unknown;
  error?: string;
}
```

**Responsibilities**:
- Parse and validate workflow definitions
- Execute workflow nodes in correct order respecting dependencies
- Manage workflow state persistence and recovery
- Handle retries and error propagation
- Implement timeout and circuit breaker logic
- Emit events for real-time UI updates via WebSocket


### 4. Tool Execution Module

**Purpose**: Provide sandboxed execution environment for agent tools with resource limits, timeout handling, and security isolation.

**Interface**:
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: ToolHandler;
  requiresSandbox: boolean;
  timeout: number;
  resourceLimits: ResourceLimits;
}

interface ResourceLimits {
  maxMemoryMB: number;
  maxCPUPercent: number;
  maxDiskMB: number;
  maxNetworkKBps?: number;
}

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

class ToolRegistry {
  private tools: Map<string, ToolDefinition>;
  
  registerTool(tool: ToolDefinition): void;
  getTool(name: string): ToolDefinition | undefined;
  getToolsForAgent(agentRole: AgentRole): ToolDefinition[];
}

class SandboxExecutor {
  private dockerClient: Docker;
  
  async executeInSandbox(
    toolName: string,
    params: unknown,
    limits: ResourceLimits
  ): Promise<ToolResult>;
  
  private async createContainer(limits: ResourceLimits): Promise<Container>;
  private async executeCommand(container: Container, command: string): Promise<string>;
  private async cleanupContainer(container: Container): Promise<void>;
}
```

**Responsibilities**:
- Maintain registry of available tools per agent role
- Execute tools in isolated Docker containers
- Enforce resource limits (CPU, memory, disk, network)
- Handle timeouts and kill runaway processes
- Sanitize inputs and outputs for security
- Log all tool executions with performance metrics


### 5. Memory Module

**Purpose**: Implement vector-based long-term memory storage allowing agents to recall company conventions, past learnings, and project history using semantic search.

**Interface**:
```typescript
interface Memory {
  id: string;
  agentRole: AgentRole;
  namespace: string;
  content: string;
  embedding: number[];
  metadata: {
    projectId?: string;
    timestamp: Date;
    importance: number;
    tags: string[];
  };
}

class MemoryService {
  private db: PrismaClient;
  private embeddingService: EmbeddingService;
  
  async saveMemory(
    agentRole: AgentRole,
    namespace: string,
    content: string,
    metadata: MemoryMetadata
  ): Promise<string>;
  
  async searchMemories(
    agentRole: AgentRole,
    namespace: string,
    query: string,
    limit: number
  ): Promise<Memory[]>;
  
  async deleteMemory(memoryId: string): Promise<void>;
  
  async pruneOldMemories(
    agentRole: AgentRole,
    retentionDays: number
  ): Promise<number>;
}

class EmbeddingService {
  private provider: 'openai' | 'voyage' | 'local';
  
  async generateEmbedding(text: string): Promise<number[]>;
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]>;
}
```

**Responsibilities**:
- Store agent memories with vector embeddings in PostgreSQL (pgvector)
- Perform semantic similarity search to retrieve relevant memories
- Namespace memories by agent role to prevent cross-contamination
- Generate embeddings using configured provider (OpenAI/Voyage/local)
- Implement memory pruning based on importance and age
- Track memory usage per agent for analytics


### 6. WebSocket Module

**Purpose**: Real-time bidirectional communication between frontend and backend for live agent activity updates, chat messages, and system notifications.

**Interface**:
```typescript
enum WebSocketEventType {
  AGENT_THINKING = 'agent:thinking',
  AGENT_ACTION = 'agent:action',
  AGENT_MESSAGE = 'agent:message',
  TASK_UPDATED = 'task:updated',
  WORKFLOW_STATE_CHANGED = 'workflow:state_changed',
  HUMAN_APPROVAL_REQUIRED = 'human:approval_required',
  SYSTEM_NOTIFICATION = 'system:notification',
}

interface WebSocketEvent {
  type: WebSocketEventType;
  timestamp: Date;
  data: unknown;
}

interface AgentThinkingEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  message: string;
}

interface AgentMessageEvent {
  agentId: string;
  agentRole: AgentRole;
  fromAgent: AgentRole;
  toAgent: AgentRole | 'all';
  message: string;
  timestamp: Date;
}

class WebSocketGateway {
  @WebSocketServer()
  private server: Server;
  
  async broadcastEvent(event: WebSocketEvent): Promise<void>;
  async sendToUser(userId: string, event: WebSocketEvent): Promise<void>;
  async sendToProject(projectId: string, event: WebSocketEvent): Promise<void>;
  
  @SubscribeMessage('subscribe:project')
  handleSubscribeProject(client: Socket, projectId: string): void;
  
  @SubscribeMessage('human:approval_response')
  handleApprovalResponse(client: Socket, response: ApprovalResponse): void;
}
```

**Responsibilities**:
- Maintain WebSocket connections with authenticated clients
- Broadcast agent activity updates to subscribed clients
- Handle room-based subscriptions (per-project channels)
- Emit typing indicators when agents are thinking
- Deliver human approval requests and receive responses
- Implement reconnection handling and message queuing


## Data Models

### Core Database Schema (Prisma)

```typescript
// User - Board of Directors
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  role          String    @default("board_member")
  passwordHash  String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  projects      Project[]
  approvals     Approval[]
}

// Project
model Project {
  id              String    @id @default(uuid())
  name            String
  description     String
  goal            String    @db.Text
  status          String    @default("active") // active, paused, completed, cancelled
  budget          Decimal?  @db.Decimal(10, 2)
  costAccrued     Decimal   @default(0) @db.Decimal(10, 2)
  createdById     String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  createdBy       User      @relation(fields: [createdById], references: [id])
  milestones      Milestone[]
  tasks           Task[]
  workflowRuns    WorkflowRun[]
  agentMessages   AgentMessage[]
}

// Milestone
model Milestone {
  id          String    @id @default(uuid())
  projectId   String
  name        String
  description String    @db.Text
  status      String    @default("pending") // pending, in_progress, completed
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  project     Project   @relation(fields: [projectId], references: [id])
  tasks       Task[]
}

// Task (Kanban)
model Task {
  id            String    @id @default(uuid())
  projectId     String
  milestoneId   String?
  title         String
  description   String    @db.Text
  status        String    @default("todo") // todo, in_progress, review, done
  priority      String    @default("medium") // low, medium, high
  assignedAgent AgentRole?
  estimatedCost Decimal?  @db.Decimal(10, 2)
  actualCost    Decimal   @default(0) @db.Decimal(10, 2)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  project       Project   @relation(fields: [projectId], references: [id])
  milestone     Milestone? @relation(fields: [milestoneId], references: [id])
  workflowSteps WorkflowStep[]
}
```

**Validation Rules**:
- Project.name must be unique per user
- Project.budget must be positive if set
- Task.status transitions follow Kanban rules (todo → in_progress → review → done)
- Task.assignedAgent must match valid AgentRole enum


```typescript
// Agent Configuration
model Agent {
  id                String    @id @default(uuid())
  role              AgentRole @unique
  name              String
  systemPrompt      String    @db.Text
  modelRouteConfig  Json      // { provider, model, fallbackProvider, tags }
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  memories          AgentMemory[]
  messages          AgentMessage[]
}

enum AgentRole {
  CEO
  PM
  DEV
  QA
  MARKETING
}

// Agent Memory (with vector embeddings)
model AgentMemory {
  id          String    @id @default(uuid())
  agentId     String
  agentRole   AgentRole
  namespace   String    // e.g., "coding_conventions", "brand_voice", "lessons_learned"
  content     String    @db.Text
  embedding   Unsupported("vector(1536)")  // pgvector column
  importance  Int       @default(5)        // 1-10 scale
  metadata    Json                         // { projectId?, timestamp, tags[] }
  createdAt   DateTime  @default(now())
  
  agent       Agent     @relation(fields: [agentId], references: [id])
  
  @@index([agentRole, namespace])
}

// Agent Message (Meeting Room chat log)
model AgentMessage {
  id          String    @id @default(uuid())
  projectId   String
  fromAgentId String
  fromRole    AgentRole
  toRole      AgentRole? // null means broadcast to all
  message     String    @db.Text
  messageType String    @default("chat") // chat, thinking, action, notification
  metadata    Json?     // Additional context
  createdAt   DateTime  @default(now())
  
  project     Project   @relation(fields: [projectId], references: [id])
  agent       Agent     @relation(fields: [fromAgentId], references: [id])
  
  @@index([projectId, createdAt])
}
```

**Validation Rules**:
- Agent.role must be unique (only one agent per role)
- AgentMemory.importance must be between 1-10
- AgentMessage.fromRole and toRole must match valid AgentRole enum
- modelRouteConfig JSON must match schema: `{ provider: string, model: string, fallbackProvider?: string, tags?: string[] }`


```typescript
// Workflow Orchestration
model WorkflowRun {
  id            String    @id @default(uuid())
  projectId     String
  workflowDefId String    // References workflow definition
  status        String    @default("running") // running, paused, completed, failed, cancelled
  currentNodeId String?
  context       Json      // Workflow execution context
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  
  project       Project   @relation(fields: [projectId], references: [id])
  steps         WorkflowStep[]
}

model WorkflowStep {
  id            String    @id @default(uuid())
  workflowRunId String
  taskId        String?
  nodeId        String
  agentRole     AgentRole?
  status        String    @default("pending") // pending, running, completed, failed, skipped
  input         Json?
  output        Json?
  error         String?   @db.Text
  retryCount    Int       @default(0)
  startedAt     DateTime?
  completedAt   DateTime?
  
  workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id])
  task          Task?       @relation(fields: [taskId], references: [id])
  
  @@index([workflowRunId, nodeId])
}

// Human Approval
model Approval {
  id            String    @id @default(uuid())
  workflowRunId String
  userId        String
  approvalType  String    // code_merge, marketing_post, milestone_complete
  status        String    @default("pending") // pending, approved, rejected
  requestData   Json      // What needs approval
  comment       String?   @db.Text
  requestedAt   DateTime  @default(now())
  respondedAt   DateTime?
  
  user          User      @relation(fields: [userId], references: [id])
}
```

**Validation Rules**:
- WorkflowRun.status transitions: running → (paused/completed/failed/cancelled)
- WorkflowStep.retryCount must not exceed workflow node's maxRetries
- Approval.status can only change from pending → (approved/rejected)
- WorkflowStep.completedAt must be after startedAt


```typescript
// API Usage Logging (9Router integration)
model ApiUsageLog {
  id                  String    @id @default(uuid())
  projectId           String?
  agentRole           AgentRole
  requestedModel      String
  actualModelUsed     String
  actualProvider      String
  isFallbackTriggered Boolean   @default(false)
  promptTokens        Int
  completionTokens    Int
  totalTokens         Int
  rtkTokenSaved       Int?      // Tokens saved by RTK compression
  estimatedCost       Decimal   @db.Decimal(10, 6)
  actualCost          Decimal   @db.Decimal(10, 6)
  responseTimeMs      Int
  createdAt           DateTime  @default(now())
  
  @@index([projectId, createdAt])
  @@index([agentRole, createdAt])
}

// 9Router Health Status
model LLMGatewayStatus {
  id                String    @id @default(uuid())
  gatewayName       String    @unique // "ninerouter"
  status            String    // "online", "offline", "degraded"
  lastHealthCheck   DateTime
  consecutiveFailures Int     @default(0)
  metadata          Json?     // Additional health metrics
  updatedAt         DateTime  @updatedAt
}
```

**Validation Rules**:
- ApiUsageLog.estimatedCost calculated from requestedModel pricing
- ApiUsageLog.actualCost calculated from actualModelUsed pricing
- ApiUsageLog.totalTokens = promptTokens + completionTokens
- LLMGatewayStatus.consecutiveFailures triggers circuit breaker at threshold (e.g., 3)
- rtkTokenSaved must be non-negative and <= promptTokens


## Algorithmic Pseudocode

### Main Processing Workflow Algorithm

```typescript
async function executeProjectWorkflow(projectId: string, goal: string): Promise<void> {
  // Preconditions:
  // - projectId exists in database
  // - goal is non-empty string
  // - At least one agent (CEO) is active
  
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');
  
  const workflowDef = await createDefaultWorkflowDefinition();
  const workflowRun = await workflowEngine.startWorkflow(workflowDef.id, {
    projectId,
    goal,
    variables: {}
  });
  
  // Loop invariant: workflowRun.status reflects current execution state
  while (workflowRun.status === 'running') {
    const currentNode = await workflowEngine.getCurrentNode(workflowRun.id);
    
    // Execute node based on type
    let result: NodeResult;
    switch (currentNode.type) {
      case 'agent_task':
        result = await executeAgentTask(currentNode, workflowRun.context);
        break;
      case 'human_approval':
        result = await requestHumanApproval(currentNode, workflowRun.context);
        break;
      case 'condition':
        result = await evaluateCondition(currentNode, workflowRun.context);
        break;
      case 'parallel':
        result = await executeParallelNodes(currentNode, workflowRun.context);
        break;
    }
    
    // Save step result
    await workflowEngine.saveStepResult(workflowRun.id, currentNode.id, result);
    
    // Transition to next node
    const nextNodeId = await workflowEngine.transitionToNextNode(
      currentNode,
      result,
      workflowRun.context
    );
    
    if (!nextNodeId) {
      workflowRun.status = 'completed';
      break;
    }
    
    // Update workflow state
    await workflowEngine.updateWorkflowRun(workflowRun.id, {
      currentNodeId: nextNodeId,
      context: workflowRun.context
    });
  }
  
  // Postconditions:
  // - workflowRun.status is 'completed', 'failed', or 'cancelled'
  // - All workflow steps are persisted in database
  // - Project.status is updated accordingly
}
```

**Preconditions:**
- projectId references valid existing project
- goal string is non-empty
- Database connection is available
- At least CEO agent is configured and active

**Postconditions:**
- WorkflowRun record created with final status
- All WorkflowStep records persisted
- Project milestones and tasks created
- WebSocket events emitted for all state changes

**Loop Invariants:**
- workflowRun.status accurately reflects execution state
- workflowRun.currentNodeId points to valid node or null
- All completed steps have corresponding WorkflowStep records


### Agent Task Execution Algorithm

```typescript
async function executeAgentTask(
  node: WorkflowNode,
  context: WorkflowContext
): Promise<NodeResult> {
  // Preconditions:
  // - node.agentRole is valid and agent exists
  // - context contains required data for task
  // - LLM provider is available
  
  const agent = await getAgentByRole(node.agentRole);
  const retryCount = 0;
  const maxRetries = node.maxRetries ?? 3;
  
  // Loop invariant: retryCount <= maxRetries
  while (retryCount <= maxRetries) {
    try {
      // Load relevant memories
      const memories = await agent.loadMemory(
        `task_${node.taskType}`,
        JSON.stringify(context)
      );
      
      // Build agent context with memories
      const agentContext: AgentContext = {
        task: node.taskType,
        projectContext: context,
        relevantMemories: memories,
        availableTools: agent.toolRegistry.getToolsForAgent(agent.role)
      };
      
      // Emit thinking event
      await websocketGateway.broadcastEvent({
        type: WebSocketEventType.AGENT_THINKING,
        data: {
          agentId: agent.id,
          agentRole: agent.role,
          message: `Analyzing ${node.taskType}...`
        }
      });
      
      // Agent thinks (LLM call)
      const thought = await agent.think(agentContext);
      
      // Agent acts (execute tools)
      const action = await agent.act(thought);
      
      // Save learnings to long-term memory
      if (action.learnings) {
        await agent.saveMemory(action.learnings, {
          namespace: `task_${node.taskType}`,
          importance: action.importance ?? 5,
          tags: [node.taskType, context.projectId]
        });
      }
      
      // Success - return result
      return {
        status: 'success',
        output: action.result
      };
      
    } catch (error) {
      retryCount++;
      
      if (retryCount > maxRetries) {
        // Max retries exceeded
        return {
          status: 'failure',
          output: null,
          error: `Agent task failed after ${maxRetries} retries: ${error.message}`
        };
      }
      
      // Exponential backoff
      await sleep(Math.pow(2, retryCount) * 1000);
    }
  }
  
  // Postconditions:
  // - Result status is 'success' or 'failure'
  // - If success, output contains agent's work product
  // - If failure, error message describes reason
  // - Memory saved if learnings generated
}
```

**Preconditions:**
- node.agentRole references valid configured agent
- context contains all required fields for task type
- LLM gateway is healthy or fallback available
- Agent has necessary tools configured

**Postconditions:**
- NodeResult returned with definitive status
- If successful, output contains task result
- Agent memories updated with learnings
- WebSocket events emitted for UI updates
- Retry count does not exceed maxRetries

**Loop Invariants:**
- retryCount never exceeds maxRetries + 1
- Each retry attempt logs to database
- Context remains immutable across retries


### LLM Call with 9Router Fallback Algorithm

```typescript
async function callLLMWithFallback(
  params: ChatParams,
  routeConfig: ModelRouteConfig
): Promise<ChatResult> {
  // Preconditions:
  // - params.messages is non-empty array
  // - routeConfig specifies provider and model
  // - At least one LLM provider is configured
  
  const gatewayStatus = await redis.get('ninerouter:health:status');
  let provider: ILLMProvider;
  
  if (gatewayStatus === 'online' && routeConfig.provider === 'ninerouter') {
    // Use 9Router as primary
    provider = llmProviderFactory.getProvider('ninerouter');
  } else {
    // Fallback to direct provider
    const fallbackProvider = routeConfig.fallbackProvider ?? 'anthropic-direct';
    provider = llmProviderFactory.getProvider(fallbackProvider);
  }
  
  const startTime = Date.now();
  let result: ChatResult;
  
  try {
    result = await provider.chat(params);
    
    // Extract actual model/provider from response
    // 9Router includes this in response headers or body
    const actualModel = result.actualModelUsed ?? params.model;
    const actualProvider = result.actualProvider ?? provider.getProviderName();
    
    // Calculate cost based on actual model used
    const cost = calculateCost(
      actualModel,
      result.tokenUsage.promptTokens,
      result.tokenUsage.completionTokens
    );
    
    // Log to database
    await db.apiUsageLog.create({
      data: {
        agentRole: getCurrentAgentRole(),
        requestedModel: params.model,
        actualModelUsed: actualModel,
        actualProvider: actualProvider,
        isFallbackTriggered: provider.getProviderName() !== 'ninerouter',
        promptTokens: result.tokenUsage.promptTokens,
        completionTokens: result.tokenUsage.completionTokens,
        totalTokens: result.tokenUsage.totalTokens,
        rtkTokenSaved: result.rtkTokenSaved,
        estimatedCost: calculateCost(params.model, ...),
        actualCost: cost,
        responseTimeMs: Date.now() - startTime
      }
    });
    
    return result;
    
  } catch (error) {
    // Circuit breaker: mark gateway as offline
    if (provider.getProviderName() === 'ninerouter') {
      await incrementHealthCheckFailures('ninerouter');
    }
    
    throw new Error(`LLM call failed: ${error.message}`);
  }
  
  // Postconditions:
  // - ChatResult returned with content
  // - ApiUsageLog record created with accurate cost
  // - Health status updated if provider failed
}
```

**Preconditions:**
- params.messages contains at least one message
- params.model is valid model identifier
- routeConfig specifies provider configuration
- Database connection available for logging

**Postconditions:**
- ChatResult contains LLM response
- actualModelUsed and actualProvider accurately recorded
- Cost calculated based on actual model, not requested
- Health check failures incremented on error
- ApiUsageLog persisted with all metadata

**Error Handling:**
- Provider failures trigger circuit breaker
- Fallback provider used when primary unavailable
- All errors logged with full context


### Vector Memory Search Algorithm

```typescript
async function searchMemories(
  agentRole: AgentRole,
  namespace: string,
  query: string,
  limit: number = 5
): Promise<Memory[]> {
  // Preconditions:
  // - agentRole is valid enum value
  // - namespace is non-empty string
  // - query is non-empty string
  // - limit is positive integer
  
  // Generate embedding for query
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  
  // Perform vector similarity search using pgvector
  // Uses cosine similarity: 1 - (embedding <=> queryEmbedding)
  const memories = await db.$queryRaw<Memory[]>`
    SELECT
      id,
      agent_role,
      namespace,
      content,
      importance,
      metadata,
      created_at,
      1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM agent_memory
    WHERE agent_role = ${agentRole}
      AND namespace = ${namespace}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;
  
  // Filter by similarity threshold (0.7 = 70% similar)
  const relevantMemories = memories.filter(m => m.similarity >= 0.7);
  
  // Boost importance in ranking
  relevantMemories.sort((a, b) => {
    const scoreA = a.similarity * 0.7 + (a.importance / 10) * 0.3;
    const scoreB = b.similarity * 0.7 + (b.importance / 10) * 0.3;
    return scoreB - scoreA;
  });
  
  return relevantMemories;
  
  // Postconditions:
  // - Returns array of Memory objects sorted by relevance
  // - All returned memories have similarity >= 0.7
  // - Array length <= limit
  // - Memories belong to specified agentRole and namespace
}
```

**Preconditions:**
- agentRole matches one of the enum values (CEO, PM, DEV, QA, MARKETING)
- namespace is non-empty identifier string
- query text is non-empty (minimum 3 characters recommended)
- limit is positive integer (typically 5-20)
- Embedding service is available and configured

**Postconditions:**
- Returns sorted array of Memory objects
- Memories filtered by similarity threshold (>= 0.7)
- Result size does not exceed limit parameter
- Memories are namespace-isolated per agent role
- Ranking combines similarity (70%) and importance (30%)

**Performance Considerations:**
- pgvector index on embedding column for fast similarity search
- Similarity calculation uses cosine distance operator (<=>)
- Typical query time: <50ms for 10K memories


## Key Functions with Formal Specifications

### Function 1: Agent.think()

```typescript
async think(context: AgentContext): Promise<AgentThought> {
  // Think method generates agent's reasoning about a task
}
```

**Preconditions:**
- `context` is non-null and well-formed AgentContext
- `context.task` is non-empty string
- `context.availableTools` is valid array (may be empty)
- Agent's LLM provider is configured and reachable
- Agent has valid system prompt

**Postconditions:**
- Returns AgentThought object with reasoning and planned actions
- AgentThought.reasoning contains LLM's analysis
- AgentThought.plannedActions array contains 0 or more tool calls
- No mutations to context parameter
- LLM call logged to ApiUsageLog table

**Side Effects:**
- Creates ApiUsageLog entry
- Emits WebSocket event (AGENT_THINKING)
- Updates agent's short-term memory (Redis) with context

**Error Handling:**
- Throws LLMProviderError if provider unavailable
- Throws ValidationError if context invalid
- Retries up to 3 times on transient failures

### Function 2: Agent.act()

```typescript
async act(thought: AgentThought): Promise<AgentAction> {
  // Act method executes the tools planned during think phase
}
```

**Preconditions:**
- `thought` is non-null AgentThought from think()
- `thought.plannedActions` contains valid tool calls
- All tools referenced exist in ToolRegistry
- Agent has permission to execute specified tools

**Postconditions:**
- Returns AgentAction with execution results
- AgentAction.success is true if all tools succeeded
- AgentAction.results contains output from each tool
- If any tool fails, AgentAction.error contains description
- Tool execution does not exceed timeout limits

**Side Effects:**
- Executes tools in sandbox containers
- Creates file modifications (write_file tool)
- Runs shell commands (run_terminal_command tool)
- Updates database (create_task, update_kanban_status tools)
- Emits WebSocket events (AGENT_ACTION)

**Resource Constraints:**
- Each tool execution limited by ResourceLimits
- Total execution time cannot exceed node.timeout
- Memory usage monitored and enforced


### Function 3: WorkflowEngine.startWorkflow()

```typescript
async startWorkflow(
  workflowDefId: string,
  initialContext: unknown
): Promise<string> {
  // Starts a new workflow execution
}
```

**Preconditions:**
- `workflowDefId` references valid WorkflowDefinition
- `initialContext` contains required fields for workflow type
- Workflow definition has valid DAG structure (no cycles)
- At least one agent required by workflow is active
- Database connection is available

**Postconditions:**
- Returns workflowRunId (UUID) for new execution
- WorkflowRun record created with status='running'
- First WorkflowStep created for startNode
- BullMQ job enqueued for workflow execution
- WebSocket event emitted (WORKFLOW_STATE_CHANGED)

**Validation:**
- Workflow definition validated before execution
- StartNode exists and has valid configuration
- All referenced agent roles exist in system
- Context validated against workflow schema

**Side Effects:**
- Creates WorkflowRun database record
- Creates initial WorkflowStep record
- Enqueues background job in Redis/BullMQ
- Initializes workflow state in memory cache

### Function 4: NineRouterHealthService.checkHealth()

```typescript
async checkHealth(): Promise<HealthStatus> {
  // Checks 9Router gateway availability
}
```

**Preconditions:**
- NINEROUTER_BASE_URL environment variable is set
- Network connectivity to 9Router endpoint
- Redis connection available for caching

**Postconditions:**
- Returns HealthStatus object with status and metadata
- HealthStatus.status is 'online', 'offline', or 'degraded'
- LLMGatewayStatus record updated in database
- Cached status stored in Redis with TTL
- consecutiveFailures counter updated

**Health Check Logic:**
- Send GET request to /health endpoint
- Timeout after 5 seconds
- Success: status=200, consecutiveFailures reset to 0
- Failure: increment consecutiveFailures
- Circuit breaker opens after 3 consecutive failures

**Side Effects:**
- Updates LLMGatewayStatus table
- Updates Redis cache with TTL
- May trigger circuit breaker state change
- Emits system notification if status changes


### Function 5: SandboxExecutor.executeInSandbox()

```typescript
async executeInSandbox(
  toolName: string,
  params: unknown,
  limits: ResourceLimits
): Promise<ToolResult> {
  // Executes tool in isolated Docker container
}
```

**Preconditions:**
- `toolName` is registered tool requiring sandbox
- `params` validated against tool's parameter schema
- `limits` specifies valid resource constraints
- Docker daemon is running and accessible
- Agent has sufficient resource quota remaining

**Postconditions:**
- Returns ToolResult with success status and output
- Container created, executed, and cleaned up
- Execution time does not exceed timeout
- Resource usage recorded in result
- No persistent container or volume remains

**Resource Enforcement:**
- Memory limited to limits.maxMemoryMB
- CPU limited to limits.maxCPUPercent
- Disk limited to limits.maxDiskMB
- Network rate limited if specified
- Process killed if timeout exceeded

**Security Isolation:**
- Container has no network access (unless tool requires)
- Filesystem is ephemeral (tmpfs)
- No access to host filesystem or Docker socket
- Runs as non-root user
- Seccomp and AppArmor profiles applied

**Error Handling:**
- Container creation failure returns error result
- Execution timeout returns partial output + timeout error
- Resource limit violations logged and returned
- Cleanup guaranteed via try-finally


## Example Usage

### Example 1: Creating a Project and Starting Workflow

```typescript
// Frontend - User submits new project
const createProject = async (goal: string) => {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'New Feature Development',
      description: 'Build user authentication system',
      goal: goal,
      budget: 100.00
    })
  });
  
  const project = await response.json();
  
  // Subscribe to project updates via WebSocket
  socket.emit('subscribe:project', project.id);
  
  return project;
};

// Backend - Project creation triggers workflow
@Post('/projects')
async createProject(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
  const project = await this.projectService.create({
    ...dto,
    createdById: user.id
  });
  
  // Start default workflow (CEO → PM → Dev → QA → Marketing)
  const workflowDef = await this.workflowService.getDefaultWorkflowDefinition();
  await this.workflowEngine.startWorkflow(workflowDef.id, {
    projectId: project.id,
    goal: project.goal,
    budget: project.budget
  });
  
  return project;
}
```

### Example 2: Agent Executing Task with Memory

```typescript
// CEO Agent planning milestones
class CEOAgent extends BaseAgent {
  async think(context: AgentContext): Promise<AgentThought> {
    // Load relevant memories about project planning
    const memories = await this.loadMemory(
      'project_planning',
      `Goal: ${context.projectContext.goal}`
    );
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt
      },
      {
        role: 'user',
        content: `
          Goal: ${context.projectContext.goal}
          
          Relevant past learnings:
          ${memories.map(m => m.content).join('\n\n')}
          
          Break this goal into 3-5 milestones with clear deliverables.
        `
      }
    ];
    
    const result = await this.callLLM(messages);
    
    return {
      reasoning: result.content,
      plannedActions: [
        {
          tool: 'create_milestone',
          params: this.parseMilestonesFromResponse(result.content)
        }
      ]
    };
  }
  
  async act(thought: AgentThought): Promise<AgentAction> {
    const results = [];
    
    for (const action of thought.plannedActions) {
      const toolResult = await this.executeTool(action.tool, action.params);
      results.push(toolResult);
    }
    
    // Save learning for future projects
    await this.saveMemory(
      `Successfully planned milestones for: ${thought.reasoning}`,
      {
        namespace: 'project_planning',
        importance: 7,
        tags: ['milestone', 'planning']
      }
    );
    
    return {
      success: results.every(r => r.success),
      results,
      learnings: thought.reasoning
    };
  }
}
```


### Example 3: 9Router Integration with Fallback

```typescript
// NineRouterProvider implementation
class NineRouterProvider implements ILLMProvider {
  private client: OpenAI;
  
  constructor(
    private baseURL: string,
    private apiKey: string
  ) {
    this.client = new OpenAI({
      baseURL: this.baseURL,
      apiKey: this.apiKey
    });
  }
  
  async chat(params: ChatParams): Promise<ChatResult> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
      tools: params.tools
    });
    
    // Extract actual model/provider from 9Router response
    // 9Router includes custom headers or fields in response
    const actualModel = response.model; // 9Router returns actual model used
    const actualProvider = response.headers?.['x-provider'] ?? 'ninerouter';
    const rtkSaved = response.headers?.['x-rtk-tokens-saved'];
    
    return {
      content: response.choices[0].message.content,
      requestedModel: params.model,
      actualModelUsed: actualModel,
      actualProvider: actualProvider,
      isFallbackTriggered: actualModel !== params.model,
      tokenUsage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      },
      rtkTokenSaved: rtkSaved ? parseInt(rtkSaved) : undefined,
      toolCalls: response.choices[0].message.tool_calls
    };
  }
  
  getProviderName(): string {
    return 'ninerouter';
  }
}

// LLMProviderFactory with circuit breaker
class LLMProviderFactory {
  async getProvider(config: ModelRouteConfig): Promise<ILLMProvider> {
    if (config.provider === 'ninerouter') {
      const health = await this.healthService.getStatus('ninerouter');
      
      if (health.consecutiveFailures >= 3) {
        // Circuit breaker open - use fallback
        console.warn('9Router circuit breaker open, using fallback');
        return this.createProvider(config.fallbackProvider ?? 'anthropic-direct');
      }
      
      return new NineRouterProvider(
        process.env.NINEROUTER_BASE_URL,
        process.env.NINEROUTER_API_KEY
      );
    }
    
    return this.createProvider(config.provider);
  }
}
```


### Example 4: Real-time UI Updates via WebSocket

```typescript
// Frontend - React component subscribing to agent activity
const VirtualOffice: React.FC = () => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [agentStatus, setAgentStatus] = useState<Map<AgentRole, string>>(new Map());
  const { projectId } = useParams();
  
  useEffect(() => {
    // Subscribe to project-specific events
    socket.emit('subscribe:project', projectId);
    
    // Handle agent thinking events
    socket.on('agent:thinking', (data: AgentThinkingEvent) => {
      setAgentStatus(prev => new Map(prev).set(data.agentRole, 'thinking'));
      setMessages(prev => [...prev, {
        id: uuidv4(),
        fromRole: data.agentRole,
        message: data.message,
        messageType: 'thinking',
        timestamp: new Date()
      }]);
    });
    
    // Handle agent messages
    socket.on('agent:message', (data: AgentMessageEvent) => {
      setAgentStatus(prev => new Map(prev).set(data.agentRole, 'idle'));
      setMessages(prev => [...prev, {
        id: uuidv4(),
        fromRole: data.fromRole,
        toRole: data.toRole,
        message: data.message,
        messageType: 'chat',
        timestamp: new Date(data.timestamp)
      }]);
    });
    
    // Handle task updates
    socket.on('task:updated', (data: TaskUpdatedEvent) => {
      // Update Kanban board
      queryClient.invalidateQueries(['tasks', projectId]);
    });
    
    return () => {
      socket.off('agent:thinking');
      socket.off('agent:message');
      socket.off('task:updated');
    };
  }, [projectId]);
  
  return (
    <Row gutter={16}>
      <Col span={12}>
        <KanbanBoard projectId={projectId} />
      </Col>
      <Col span={12}>
        <MeetingRoom 
          messages={messages} 
          agentStatus={agentStatus} 
        />
      </Col>
    </Row>
  );
};
```


## Correctness Properties

### Property 1: Workflow State Consistency
**Universal Quantification**: For all workflow runs `w` at any point in time, if `w.status = 'running'`, then `w.currentNodeId` references a valid node in the workflow definition, and there exists exactly one pending or running WorkflowStep for that node.

**Validates: Requirements 2.3, 14.1, 14.2**

**Formal Statement**:
```
∀w ∈ WorkflowRun: 
  (w.status = 'running') ⟹ 
    (∃!s ∈ WorkflowStep: 
      s.workflowRunId = w.id ∧ 
      s.nodeId = w.currentNodeId ∧ 
      s.status ∈ {'pending', 'running'})
```

**Property-Based Test Approach**:
- Generate random workflow definitions and execution scenarios
- Assert that at any point during execution, exactly one step is active
- Verify state transitions never create orphaned steps
- Check that completed workflows have all steps in terminal states

### Property 2: Agent Memory Isolation
**Universal Quantification**: For all agents `a1` and `a2` with different roles, the memories retrieved by `a1` never contain memories created by `a2`, ensuring complete namespace isolation.

**Validates: Requirements 8.1, 8.2, 8.3**

**Formal Statement**:
```
∀a1, a2 ∈ Agent, ∀m ∈ Memory:
  (a1.role ≠ a2.role ∧ m ∈ a1.loadMemory(namespace, query)) ⟹
    m.agentRole = a1.role
```

**Property-Based Test Approach**:
- Create memories for multiple agent roles
- Execute search queries for each agent
- Assert retrieved memories only match querying agent's role
- Verify no cross-contamination across namespaces

### Property 3: Cost Tracking Accuracy
**Universal Quantification**: For all API usage logs `l`, the `actualCost` is calculated based on `actualModelUsed` pricing, not `requestedModel`, ensuring accurate billing when 9Router triggers fallback.

**Validates: Requirements 11.1, 11.2, 11.3**

**Formal Statement**:
```
∀l ∈ ApiUsageLog:
  l.actualCost = calculateCost(
    l.actualModelUsed,
    l.promptTokens,
    l.completionTokens
  )
```

**Property-Based Test Approach**:
- Generate LLM calls with various models and fallback scenarios
- Assert actualCost always matches actualModelUsed pricing
- Verify estimatedCost may differ from actualCost when fallback occurs
- Check that sum of project costs matches sum of task costs


### Property 4: Sandbox Resource Limits Enforcement
**Universal Quantification**: For all tool executions `t` in sandbox containers, the actual resource usage never exceeds the specified limits, and execution is terminated if timeout is reached.

**Validates: Requirements 6.2, 6.3, 6.6, 6.8**

**Formal Statement**:
```
∀t ∈ ToolExecution:
  (t.requiresSandbox = true) ⟹
    (t.resourceUsage.memoryMB ≤ t.limits.maxMemoryMB ∧
     t.resourceUsage.cpuPercent ≤ t.limits.maxCPUPercent ∧
     t.executionTimeMs ≤ t.timeout)
```

**Property-Based Test Approach**:
- Execute tools with various resource configurations
- Assert memory/CPU never exceed configured limits
- Verify long-running tools are killed at timeout
- Check that violations result in error ToolResult, not uncaught exceptions

### Property 5: Circuit Breaker Fallback
**Universal Quantification**: For all LLM provider requests, if the primary provider (9Router) has `consecutiveFailures ≥ 3`, then the request must be routed to the fallback provider.

**Validates: Requirements 5.3, 5.4, 4.3**

**Formal Statement**:
```
∀r ∈ LLMRequest, ∀h ∈ LLMGatewayStatus:
  (r.config.provider = 'ninerouter' ∧ 
   h.gatewayName = 'ninerouter' ∧
   h.consecutiveFailures ≥ 3) ⟹
     actualProviderUsed(r) = r.config.fallbackProvider
```

**Property-Based Test Approach**:
- Simulate 9Router failures to increment failure counter
- Assert that circuit breaker opens at threshold
- Verify subsequent requests use fallback provider
- Check that circuit breaker closes after successful health check

### Property 6: Workflow DAG Acyclicity
**Universal Quantification**: For all workflow definitions `w`, the directed graph formed by nodes and edges must be acyclic (DAG property), ensuring workflows always terminate.

**Validates: Requirements 2.1, 13.1, 13.2, 13.3**

**Formal Statement**:
```
∀w ∈ WorkflowDefinition:
  ¬∃ path p in w.graph: 
    p.start = p.end ∧ length(p) > 0
```

**Property-Based Test Approach**:
- Generate random workflow graphs
- Run cycle detection algorithm (DFS)
- Assert no cycles exist in valid workflows
- Verify workflow validation rejects cyclic definitions


## Error Handling

### Error Scenario 1: LLM Provider Unavailable

**Condition**: 9Router gateway is offline or unreachable, and direct Anthropic API also fails.

**Response**: 
- System detects health check failures via NineRouterHealthService
- Circuit breaker opens after 3 consecutive failures
- Fallback to AnthropicDirectProvider attempted
- If fallback also fails, workflow step marked as 'failed' with retry eligible

**Recovery**: 
- Workflow engine retries step up to maxRetries (default 3)
- Exponential backoff between retries (2^n seconds)
- If all retries exhausted, workflow paused for human intervention
- User notified via WebSocket notification
- Background health checks continue, circuit breaker closes when provider recovers

### Error Scenario 2: Tool Execution Timeout

**Condition**: Agent tool execution (e.g., run_tests) exceeds configured timeout limit in sandbox container.

**Response**:
- SandboxExecutor monitors execution time
- Container forcefully terminated via Docker stop (SIGTERM then SIGKILL)
- Partial output captured if available
- ToolResult returned with success=false and timeout error message
- Resource usage metrics collected before cleanup

**Recovery**:
- Agent's act() method receives failed ToolResult
- Agent can decide to retry with different parameters
- Workflow step may be retried based on retry policy
- Timeout increased for subsequent retry attempts
- If persistent, escalates to human approval

### Error Scenario 3: Memory Vector Search Failure

**Condition**: pgvector extension query fails or embedding service unavailable.

**Response**:
- MemoryService catches database or embedding errors
- Logs error with full context (agent role, namespace, query)
- Returns empty memory array rather than throwing exception
- Agent proceeds with task using only current context (no past memories)
- System monitoring alerted to degraded memory functionality

**Recovery**:
- Agent execution continues without memories (graceful degradation)
- Background retry of embedding service connection
- Health dashboard shows memory service status
- Database connection pool auto-recovers if transient issue
- Manual intervention required for persistent embedding service issues


### Error Scenario 4: Workflow State Corruption

**Condition**: System crash or database inconsistency leaves WorkflowRun in invalid state (e.g., status='running' but no current node).

**Response**:
- WorkflowEngine validation checks detect inconsistency on resume
- Corrupted workflow run flagged with status='error'
- Detailed diagnostic information logged (last successful step, stack trace)
- WebSocket notification sent to project owner
- Workflow cannot be resumed automatically

**Recovery**:
- Admin dashboard shows corrupted workflows
- Recovery script can analyze workflow history and suggest resume point
- Manual intervention to either restart from checkpoint or cancel workflow
- Database transaction logs reviewed to identify root cause
- Improved validation added to prevent recurrence

### Error Scenario 5: Sandbox Container Resource Exhaustion

**Condition**: Tool execution attempts to allocate more memory or CPU than allowed by ResourceLimits.

**Response**:
- Docker enforces hard limits via cgroups
- Container receives OOM kill or CPU throttling
- SandboxExecutor detects abnormal container exit
- ToolResult returned with resource_exhausted error
- Resource usage metrics logged for analysis

**Recovery**:
- Agent receives failed ToolResult with resource details
- Workflow step may be retried with increased limits (if policy allows)
- If task legitimately requires more resources, human approval requested
- System learns resource requirements for similar tasks
- Future executions of same tool type allocated appropriate resources


## Testing Strategy

### Unit Testing Approach

**Scope**: Individual functions and classes in isolation with mocked dependencies.

**Key Test Cases**:

1. **BaseAgent Class**:
   - `loadMemory()` returns relevant memories based on semantic similarity
   - `saveMemory()` stores memory with correct embedding and namespace
   - `callLLM()` properly formats messages and handles provider responses
   - `executeTool()` validates parameters and handles tool failures

2. **WorkflowEngine**:
   - `startWorkflow()` creates proper initial state
   - `executeNode()` handles all node types correctly
   - `transitionToNextNode()` evaluates conditions accurately
   - `saveWorkflowState()` persists state atomically
   - DAG validation rejects cyclic graphs

3. **LLMProviderFactory**:
   - `getProvider()` selects correct provider based on config and health
   - Circuit breaker opens/closes at correct thresholds
   - Provider selection respects modelRouteConfig preferences

4. **SandboxExecutor**:
   - `executeInSandbox()` enforces all resource limits
   - Container cleanup occurs even on exceptions
   - Timeout handling works correctly
   - Output sanitization prevents injection attacks

5. **MemoryService**:
   - `searchMemories()` returns results sorted by relevance
   - Namespace isolation prevents cross-agent memory leaks
   - Embedding generation integrates correctly with provider

**Coverage Goals**: 
- Line coverage: >85% for core modules
- Branch coverage: >80% for control flow logic
- 100% coverage for critical paths (LLM calls, workflow state transitions)

**Testing Frameworks**:
- Jest for unit tests
- ts-mockito or jest.mock() for mocking
- faker.js for generating test data


### Property-Based Testing Approach

**Scope**: Test invariants and correctness properties across wide range of generated inputs.

**Property Test Library**: **fast-check** (JavaScript/TypeScript property-based testing library)

**Key Properties to Test**:

1. **Workflow State Consistency** (Property 1):
```typescript
import * as fc from 'fast-check';

fc.assert(
  fc.property(
    fc.array(workflowNodeArbitrary, { minLength: 3, maxLength: 10 }),
    fc.uuid(),
    async (nodes, projectId) => {
      const workflow = await createWorkflowFromNodes(nodes);
      const runId = await workflowEngine.startWorkflow(workflow.id, { projectId });
      
      // At any point during execution
      const run = await db.workflowRun.findUnique({ where: { id: runId } });
      if (run.status === 'running') {
        const activeSteps = await db.workflowStep.findMany({
          where: { 
            workflowRunId: runId,
            status: { in: ['pending', 'running'] }
          }
        });
        
        // Exactly one active step
        expect(activeSteps.length).toBe(1);
        expect(activeSteps[0].nodeId).toBe(run.currentNodeId);
      }
    }
  ),
  { numRuns: 100 }
);
```

2. **Agent Memory Isolation** (Property 2):
```typescript
fc.assert(
  fc.property(
    fc.array(memoryArbitrary, { minLength: 10, maxLength: 50 }),
    fc.constantFrom(AgentRole.CEO, AgentRole.PM, AgentRole.DEV),
    fc.string(),
    async (memories, queryingRole, searchQuery) => {
      // Store memories for all agent roles
      for (const memory of memories) {
        await memoryService.saveMemory(
          memory.agentRole,
          memory.namespace,
          memory.content,
          memory.metadata
        );
      }
      
      // Search from specific agent
      const results = await memoryService.searchMemories(
        queryingRole,
        'test_namespace',
        searchQuery,
        10
      );
      
      // All results must belong to querying agent
      results.forEach(result => {
        expect(result.agentRole).toBe(queryingRole);
      });
    }
  ),
  { numRuns: 50 }
);
```

3. **Cost Tracking Accuracy** (Property 3):
```typescript
fc.assert(
  fc.property(
    fc.record({
      requestedModel: fc.constantFrom('claude-sonnet-4', 'gpt-4', 'gpt-3.5-turbo'),
      actualModelUsed: fc.constantFrom('claude-sonnet-4', 'gpt-3.5-turbo', 'claude-haiku'),
      promptTokens: fc.integer({ min: 100, max: 10000 }),
      completionTokens: fc.integer({ min: 50, max: 5000 })
    }),
    async (logData) => {
      const expectedCost = calculateCost(
        logData.actualModelUsed,
        logData.promptTokens,
        logData.completionTokens
      );
      
      const log = await db.apiUsageLog.create({
        data: {
          ...logData,
          agentRole: AgentRole.CEO,
          estimatedCost: calculateCost(logData.requestedModel, ...),
          actualCost: expectedCost
        }
      });
      
      // Actual cost must match calculation from actual model
      expect(log.actualCost).toBe(expectedCost);
    }
  ),
  { numRuns: 200 }
);
```

**Benefits**:
- Discovers edge cases not covered by example-based tests
- Validates invariants across thousands of generated scenarios
- Finds bugs through randomized input exploration
- Provides confidence in correctness properties


### Integration Testing Approach

**Scope**: Test interactions between multiple modules with real dependencies (database, Redis, Docker).

**Key Integration Test Scenarios**:

1. **End-to-End Workflow Execution**:
   - Create project with goal
   - Start default workflow (CEO → PM → Dev → QA)
   - Mock LLM responses to control agent behavior
   - Verify workflow completes with all expected tasks created
   - Check database state consistency at each step
   - Validate WebSocket events emitted in correct order

2. **9Router Integration**:
   - Start local 9Router instance in test environment
   - Configure agent to use 9Router provider
   - Execute LLM calls through 9Router
   - Verify actualModelUsed tracked correctly
   - Test fallback when 9Router stopped mid-execution
   - Validate cost logging with fallback scenarios

3. **Memory System Integration**:
   - Save memories for multiple agents
   - Perform semantic search queries
   - Verify pgvector similarity search works correctly
   - Test namespace isolation between agent roles
   - Check memory pruning functionality
   - Validate embedding generation pipeline

4. **Sandbox Tool Execution**:
   - Execute write_file tool in Docker container
   - Verify file created in ephemeral filesystem
   - Test resource limit enforcement (memory/CPU)
   - Validate timeout handling kills runaway processes
   - Check proper container cleanup after execution

5. **Real-time Communication**:
   - Connect WebSocket client to server
   - Subscribe to project channel
   - Trigger agent activity
   - Verify events received in correct order with proper data
   - Test reconnection handling after disconnect
   - Validate room-based message filtering

**Test Environment Setup**:
- Docker Compose for test infrastructure (Postgres, Redis, 9Router)
- Database seeded with test data before each suite
- Cleanup after tests to ensure isolation
- Mock external services (embedding APIs) for speed

**Testing Frameworks**:
- Jest for test runner
- Supertest for HTTP API testing
- socket.io-client for WebSocket testing
- Testcontainers for Docker orchestration


## Performance Considerations

### 1. LLM Call Optimization

**Challenge**: LLM API calls are the primary latency and cost bottleneck (200ms-3s per call, $0.001-$0.03 per call).

**Optimizations**:
- **9Router RTK Token Saver**: Automatically compresses tool output (git diffs, logs, test results) before sending to LLM, reducing input tokens by 20-40%
- **Context Window Management**: Implement sliding window for agent conversation history, pruning old messages beyond 4K tokens
- **Batch Processing**: Group similar agent tasks (e.g., multiple code reviews) into single LLM call with structured output
- **Caching**: Cache LLM responses for identical inputs using Redis (key: hash of messages + model)
- **Streaming**: Use SSE streaming for long-running agent thoughts to provide real-time feedback

**Metrics**:
- Target P95 latency: <2s per agent action
- Cost per project: <$1 for MVP scale
- Cache hit rate: >30% for repeated tasks

### 2. Vector Search Performance

**Challenge**: Semantic memory search requires embedding generation + similarity calculation across thousands of vectors.

**Optimizations**:
- **pgvector Indexing**: Create IVFFlat or HNSW index on embedding column
  ```sql
  CREATE INDEX idx_agent_memory_embedding 
  ON agent_memory 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
  ```
- **Dimensionality**: Use 768-dim embeddings (bge-small) instead of 1536-dim (OpenAI) for 50% space/speed improvement
- **Pre-filtering**: Filter by agentRole and namespace before vector search to reduce search space
- **Embedding Caching**: Cache embeddings for common queries in Redis
- **Batch Embedding**: Generate embeddings for multiple texts in single API call

**Metrics**:
- Target search latency: <50ms for 10K memories
- Index build time: <5s for 100K memories
- Memory usage: ~50MB per 10K memories (768-dim floats)

### 3. Workflow Engine Throughput

**Challenge**: Support multiple concurrent workflows across projects without queue backlog.

**Optimizations**:
- **BullMQ Concurrency**: Configure worker concurrency based on CPU cores (default: 5 workers)
- **Node Parallelization**: Execute independent workflow nodes in parallel (e.g., multiple Dev agents on separate tasks)
- **State Caching**: Cache workflow context in Redis to avoid repeated DB reads
- **Queue Prioritization**: High-priority projects (human waiting) processed before background tasks
- **Horizontal Scaling**: Deploy multiple API instances sharing Redis queue

**Metrics**:
- Target throughput: 50 concurrent workflows
- Queue processing delay: <1s P95
- Workflow completion time: <5min for typical 10-task project


### 4. Real-time Communication Scalability

**Challenge**: WebSocket connections consume memory and CPU; need to support multiple simultaneous users watching agent activity.

**Optimizations**:
- **Room-based Broadcasting**: Use Socket.IO rooms for per-project isolation, reducing broadcast fanout
- **Message Throttling**: Limit agent message rate to 10/second per project to prevent flooding
- **Connection Pooling**: Reuse Redis connections for pub/sub
- **Selective Subscriptions**: Clients subscribe only to events they display (no silent subscriptions)
- **Compression**: Enable WebSocket compression for text messages

**Metrics**:
- Target concurrent connections: 500 per server instance
- Message delivery latency: <100ms P95
- Memory per connection: <1MB
- Broadcast fanout time: <50ms for 50 subscribers

### 5. Database Query Optimization

**Challenge**: Complex queries for workflow state, task history, and agent messages can become slow at scale.

**Optimizations**:
- **Indexing Strategy**:
  ```sql
  CREATE INDEX idx_workflow_steps_run_node ON workflow_step(workflow_run_id, node_id);
  CREATE INDEX idx_agent_messages_project_time ON agent_message(project_id, created_at DESC);
  CREATE INDEX idx_api_logs_project_time ON api_usage_log(project_id, created_at DESC);
  CREATE INDEX idx_tasks_project_status ON task(project_id, status);
  ```
- **Query Pagination**: Limit result sets to 50 items, use cursor-based pagination for infinite scroll
- **Partial Indexes**: Index only active workflows: `WHERE status = 'running'`
- **Connection Pooling**: Prisma connection pool sized appropriately (10-20 connections)
- **Read Replicas**: Route read-heavy queries (dashboards, history) to replica if deployed

**Metrics**:
- Target query latency: <20ms P95 for indexed queries
- Dashboard load time: <500ms
- Connection pool exhaustion: 0 occurrences


## Security Considerations

### 1. Sandbox Isolation

**Threat Model**: Malicious or buggy LLM-generated code executed by Dev Agent could escape sandbox and compromise host system.

**Mitigations**:
- **Docker Isolation**: All tool execution runs in ephemeral containers with no access to host filesystem or Docker socket
- **Resource Limits**: Strict CPU, memory, disk, and network limits enforced via cgroups
- **No Privileged Mode**: Containers run without `--privileged` flag
- **Network Isolation**: Containers have no network access by default (unless tool explicitly requires it)
- **Read-only Filesystem**: Root filesystem mounted read-only, with tmpfs for /tmp
- **User Namespace**: Containers run as non-root user (UID 1000)
- **Seccomp Profile**: Custom seccomp profile blocks dangerous syscalls (mount, reboot, etc.)
- **AppArmor/SELinux**: Enable mandatory access control profiles
- **Timeout Enforcement**: Hard kill after timeout prevents resource exhaustion attacks

**Security Testing**:
- Attempt container escape exploits (CVE-2019-5736, etc.)
- Try to access host filesystem or Docker socket
- Resource exhaustion attacks (fork bombs, memory bombs)
- Network exfiltration attempts

### 2. LLM Prompt Injection

**Threat Model**: Malicious user input or file contents could inject instructions that override agent system prompts, causing unintended behavior.

**Mitigations**:
- **Input Sanitization**: Strip potential prompt injection markers from user inputs (`Ignore previous instructions`, etc.)
- **Structured Prompts**: Use clearly delimited sections for system prompt vs user content
- **Output Validation**: Validate agent outputs against expected schema before execution
- **Tool Parameter Validation**: Strict schema validation for all tool parameters
- **Least Privilege**: Agents only have access to tools necessary for their role
- **Human Approval**: Require approval for high-risk actions (code deployment, data deletion)
- **Audit Logging**: Log all LLM interactions with full prompts for forensic analysis

**Example Mitigation**:
```typescript
function sanitizeUserInput(input: string): string {
  // Remove common prompt injection patterns
  const patterns = [
    /ignore previous instructions/gi,
    /system:\s*you are now/gi,
    /assistant:\s*I will/gi,
    /<\|im_start\|>/gi
  ];
  
  let sanitized = input;
  patterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  });
  
  return sanitized;
}
```


### 3. API Key and Secret Management

**Threat Model**: Exposed API keys (9Router, Anthropic, OpenAI, embedding providers) could lead to unauthorized usage and cost abuse.

**Mitigations**:
- **Environment Variables**: Store all secrets in environment variables, never commit to git
- **Docker Secrets**: Use Docker Swarm secrets or Kubernetes secrets in production
- **Access Control**: Restrict API key access to backend services only, never expose to frontend
- **Key Rotation**: Regularly rotate API keys (quarterly)
- **Rate Limiting**: Implement rate limits on API endpoints to prevent abuse
- **Cost Alerts**: Alert when daily/weekly cost thresholds exceeded
- **Auto-Pause**: Automatically pause all workflows if budget exhausted

**Example .env Structure**:
```bash
# Never commit this file
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
NINEROUTER_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
EMBEDDING_API_KEY="..."
JWT_SECRET="..."
```

### 4. Authentication and Authorization

**Threat Model**: Unauthorized access to projects, ability to execute agent actions on behalf of other users.

**Mitigations**:
- **JWT-based Auth**: Stateless authentication with short-lived tokens (1h expiry)
- **Refresh Tokens**: Long-lived refresh tokens (7 days) stored securely in httpOnly cookies
- **Password Hashing**: bcrypt with salt rounds >= 12
- **Project Ownership**: Enforce that users can only access their own projects
- **Role-Based Access**: "Board of Directors" role required for approvals
- **WebSocket Auth**: Validate JWT on WebSocket connection handshake
- **CSRF Protection**: CSRF tokens for state-changing operations

**Authorization Check Example**:
```typescript
@UseGuards(JwtAuthGuard, ProjectOwnershipGuard)
@Get('/projects/:id')
async getProject(@Param('id') id: string, @CurrentUser() user: User) {
  return this.projectService.findOne(id);
}
```


### 5. Data Privacy and 9Router Considerations

**Threat Model**: 9Router acts as MITM proxy seeing all LLM prompts/responses; free-tier providers may not have strong privacy guarantees.

**Mitigations**:
- **Provider Selection**: Use tier-1 subscription providers (Claude, GPT-4) for sensitive data
- **Free Tier Restrictions**: Configure 9Router to exclude free providers for projects with customer data
- **Data Masking**: Automatically mask PII (emails, phone numbers, API keys) in prompts before sending to LLM
- **Local 9Router**: Run 9Router on same private network as AI Corp backend, not exposed to internet
- **Audit Trail**: Log which provider handled each request for compliance tracking
- **Terms of Service**: Clearly inform users that free-tier providers may use data for training

**9Router Configuration**:
```json
{
  "tiers": [
    {
      "name": "tier1",
      "providers": ["anthropic-claude", "openai-gpt4"],
      "allowCustomerData": true
    },
    {
      "name": "tier2", 
      "providers": ["openai-gpt3.5", "google-gemini"],
      "allowCustomerData": false
    },
    {
      "name": "tier3",
      "providers": ["kiro-free", "opencode-free"],
      "allowCustomerData": false,
      "devOnly": true
    }
  ]
}
```

### 6. Docker Security

**Threat Model**: Vulnerable Docker images or misconfigurations could expose system to attacks.

**Mitigations**:
- **Official Images**: Use official base images (node:20-alpine, postgres:16, redis:7)
- **Image Scanning**: Scan images for CVEs using Trivy or Snyk
- **Regular Updates**: Keep base images updated with security patches
- **Minimal Images**: Use Alpine Linux for smaller attack surface
- **No Root**: Run all containers as non-root users
- **Docker Socket Protection**: Never mount Docker socket into containers
- **Network Policies**: Use Docker networks to isolate containers


## Dependencies

### Core Backend Dependencies (NestJS)

| Package | Version | Purpose |
|---------|---------|---------|
| @nestjs/core | ^10.0.0 | NestJS framework core |
| @nestjs/common | ^10.0.0 | Common utilities and decorators |
| @nestjs/platform-express | ^10.0.0 | Express adapter for HTTP |
| @nestjs/websockets | ^10.0.0 | WebSocket support |
| @nestjs/platform-socket.io | ^10.0.0 | Socket.IO integration |
| @prisma/client | ^5.0.0 | Database ORM client |
| prisma | ^5.0.0 | Prisma CLI and migrations |
| @anthropic-ai/sdk | ^0.20.0 | Anthropic Claude API client |
| openai | ^4.0.0 | OpenAI API client (also for 9Router) |
| bullmq | ^5.0.0 | Redis-based job queue |
| ioredis | ^5.3.0 | Redis client |
| bcrypt | ^5.1.0 | Password hashing |
| jsonwebtoken | ^9.0.0 | JWT token handling |
| class-validator | ^0.14.0 | DTO validation |
| class-transformer | ^0.5.0 | DTO transformation |
| dockerode | ^4.0.0 | Docker API client for sandbox |

### Frontend Dependencies (React)

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.2.0 | React library |
| react-dom | ^18.2.0 | React DOM rendering |
| vite | ^5.0.0 | Build tool and dev server |
| antd | ^5.12.0 | Ant Design component library |
| @ant-design/icons | ^5.2.0 | Ant Design icons |
| zustand | ^4.4.0 | State management |
| @tanstack/react-query | ^5.0.0 | Data fetching and caching |
| socket.io-client | ^4.6.0 | WebSocket client |
| @dnd-kit/core | ^6.1.0 | Drag-and-drop for Kanban |
| @dnd-kit/sortable | ^8.0.0 | Sortable lists |
| recharts | ^2.10.0 | Charts and visualizations |
| axios | ^1.6.0 | HTTP client |
| react-router-dom | ^6.20.0 | Routing |

### Infrastructure Dependencies

| Service | Version | Purpose |
|---------|---------|---------|
| PostgreSQL | 16 | Primary database with pgvector |
| Redis | 7 | Cache and BullMQ queue backend |
| Docker | 24+ | Container runtime for sandboxes |
| 9Router | latest | LLM gateway with fallback (decolua/9router) |


### Optional Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @nestjs/swagger | ^7.0.0 | API documentation (optional) |
| helmet | ^7.1.0 | Security headers (recommended) |
| @nestjs/throttler | ^5.0.0 | Rate limiting (recommended) |
| winston | ^3.11.0 | Structured logging (recommended) |
| pino | ^8.16.0 | Alternative fast logger |
| sentry | ^7.0.0 | Error tracking (production) |
| datadog-metrics | ^0.11.0 | Monitoring (production) |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.3.0 | TypeScript compiler |
| @types/node | ^20.0.0 | Node.js type definitions |
| @types/react | ^18.2.0 | React type definitions |
| @types/bcrypt | ^5.0.0 | bcrypt type definitions |
| @types/jsonwebtoken | ^9.0.0 | JWT type definitions |
| jest | ^29.7.0 | Testing framework |
| @testing-library/react | ^14.0.0 | React testing utilities |
| ts-mockito | ^2.6.0 | TypeScript mocking |
| fast-check | ^3.15.0 | Property-based testing |
| eslint | ^8.56.0 | Linting |
| prettier | ^3.1.0 | Code formatting |
| turbo | ^1.11.0 | Monorepo build system (optional) |

### External APIs

| Service | Purpose | Authentication |
|---------|---------|----------------|
| Anthropic Claude API | Primary LLM provider (via 9Router or direct) | API key |
| OpenAI API | Fallback LLM provider | API key |
| Voyage AI / OpenAI | Embedding generation for vector search | API key |
| 9Router Gateway | LLM request routing with fallback | API key (from dashboard) |

### Monorepo Configuration

**Package Manager**: pnpm (recommended) or npm workspaces

**Build Tool**: Turbo (optional but recommended for caching)

**Workspace Structure**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Shared Dependencies**:
- TypeScript configurations in `packages/config/tsconfig/`
- ESLint configurations in `packages/config/eslint-config/`
- Shared types in `packages/shared-types/`


## API Endpoints Reference

### Project Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/projects` | Create new project | Yes |
| GET | `/api/projects` | List user's projects | Yes |
| GET | `/api/projects/:id` | Get project details | Yes (owner) |
| PATCH | `/api/projects/:id` | Update project | Yes (owner) |
| DELETE | `/api/projects/:id` | Delete project | Yes (owner) |
| POST | `/api/projects/:id/start` | Start project workflow | Yes (owner) |
| POST | `/api/projects/:id/pause` | Pause project workflow | Yes (owner) |

### Task Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/projects/:projectId/tasks` | List project tasks | Yes |
| GET | `/api/tasks/:id` | Get task details | Yes |
| PATCH | `/api/tasks/:id` | Update task status | Yes |
| POST | `/api/tasks/:id/assign` | Assign task to agent | Yes |

### Agent Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/agents` | List all agents | Yes |
| GET | `/api/agents/:role` | Get agent by role | Yes |
| PATCH | `/api/agents/:role/config` | Update agent configuration | Yes (admin) |
| GET | `/api/agents/:role/memories` | Get agent memories | Yes |
| GET | `/api/agents/:role/messages` | Get agent message history | Yes |

### Human Approval

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/approvals/pending` | List pending approvals | Yes |
| POST | `/api/approvals/:id/approve` | Approve request | Yes |
| POST | `/api/approvals/:id/reject` | Reject request | Yes |

### System Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/system/health` | System health check | No |
| GET | `/api/system/llm-gateway-status` | 9Router status | Yes |
| GET | `/api/system/usage` | API usage statistics | Yes |
| GET | `/api/system/costs` | Cost breakdown | Yes (admin) |

### WebSocket Events

| Event | Direction | Description | Payload |
|-------|-----------|-------------|---------|
| `subscribe:project` | Client → Server | Subscribe to project updates | `{ projectId: string }` |
| `agent:thinking` | Server → Client | Agent is processing | `AgentThinkingEvent` |
| `agent:message` | Server → Client | Agent sent message | `AgentMessageEvent` |
| `agent:action` | Server → Client | Agent executed action | `AgentActionEvent` |
| `task:updated` | Server → Client | Task status changed | `TaskUpdatedEvent` |
| `workflow:state_changed` | Server → Client | Workflow state changed | `WorkflowStateEvent` |
| `human:approval_required` | Server → Client | Approval needed | `ApprovalRequiredEvent` |
| `human:approval_response` | Client → Server | Approval response | `ApprovalResponse` |
| `system:notification` | Server → Client | System notification | `NotificationEvent` |


## Docker Compose Configuration

### Development Environment Setup

```yaml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: ai-corp-postgres
    environment:
      POSTGRES_USER: aicorp
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: aicorp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aicorp"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: ai-corp-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  ninerouter:
    image: decolua/9router:latest
    container_name: ai-corp-ninerouter
    ports:
      - "20128:20128"
    volumes:
      - ninerouter_config:/app/config
    environment:
      - NINEROUTER_PORT=20128
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:20128/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: ai-corp-api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://aicorp:dev_password@postgres:5432/aicorp_dev
      REDIS_URL: redis://redis:6379
      NINEROUTER_BASE_URL: http://ninerouter:20128/v1
      NINEROUTER_API_KEY: ${NINEROUTER_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      JWT_SECRET: ${JWT_SECRET:-dev_secret_change_in_production}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      ninerouter:
        condition: service_healthy
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # For sandbox containers

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: ai-corp-web
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_WS_URL: ws://localhost:3000
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
  ninerouter_config:
```

### Environment Variables Required

```bash
# .env file (not committed to git)
NINEROUTER_API_KEY=your_9router_api_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
EMBEDDING_API_KEY=your_embedding_key_here
JWT_SECRET=your_jwt_secret_here
```


## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)

**Deliverables**:
- Monorepo structure with pnpm workspaces
- Database schema (Prisma) with migrations
- Docker Compose setup with Postgres + pgvector, Redis, 9Router
- Basic NestJS API with modules structure
- Authentication (JWT) and authorization
- Vite + React frontend skeleton with Ant Design

**Acceptance Criteria**:
- `docker-compose up` starts all services
- Database migrations run successfully with pgvector extension
- Frontend can authenticate and receive JWT token
- Basic health check endpoints working

### Phase 2: Agent Foundation (Weeks 3-4)

**Deliverables**:
- BaseAgent abstract class implementation
- LLM Provider abstraction layer (ILLMProvider)
- NineRouterProvider with circuit breaker
- AnthropicDirectProvider as fallback
- MemoryService with vector search
- Simple CEOAgent implementation (milestone planning only)

**Acceptance Criteria**:
- CEOAgent can receive goal and call LLM via 9Router
- LLM responses logged to ApiUsageLog with correct cost tracking
- Vector memory search returns relevant results
- Circuit breaker triggers fallback after 3 failures
- Agent memories isolated by role

### Phase 3: Workflow Engine (Weeks 5-6)

**Deliverables**:
- WorkflowEngine with DAG execution
- BullMQ integration for task queue
- WorkflowRun and WorkflowStep persistence
- Simple workflow: CEO → PM (2 agents only for MVP)
- WebSocket gateway for real-time events
- Human approval mechanism

**Acceptance Criteria**:
- Create project triggers workflow execution
- CEO Agent creates milestones, PM Agent creates tasks
- Workflow state persisted and resumable after restart
- WebSocket events emitted for each agent action
- Human approval blocks workflow until response


### Phase 4: Frontend Dashboard & Virtual Office (Weeks 7-8)

**Deliverables**:
- Dashboard with project overview, cost tracking, 9Router status badge
- Virtual Office layout: Kanban board + Meeting Room (2-column)
- Kanban board with drag-and-drop using @dnd-kit
- Meeting Room chat interface with agent avatars and typing indicators
- Agent Detail Drawer showing memories and configuration
- WebSocket connection with auto-reconnect

**Acceptance Criteria**:
- Dashboard displays real-time project statistics
- Kanban columns update automatically via WebSocket
- Meeting Room shows agent messages in real-time
- Drag-and-drop task status changes persist to database
- Agent Detail Drawer displays memories from vector search
- 9Router status badge reflects actual health

### Phase 5: Tool Execution & Sandbox (Weeks 9-10)

**Deliverables**:
- SandboxExecutor with Docker container management
- ToolRegistry with tool definitions
- Dev Agent tools: write_file, read_file, run_terminal_command, run_tests
- QA Agent tools: read_file, run_tests, create_review_comment
- Resource limit enforcement
- Timeout handling

**Acceptance Criteria**:
- Dev Agent can execute write_file in sandbox
- Sandbox containers isolated (no host access)
- Resource limits enforced (memory, CPU, disk)
- Timeout kills runaway processes
- Container cleanup happens reliably
- Tool outputs logged and displayed in UI

### Phase 6: Full Workflow & Testing (Weeks 11-12)

**Deliverables**:
- Complete workflow: CEO → PM → Dev → QA → Marketing
- Dev/QA review loop with retry logic
- Cost Guard with budget alerts and auto-pause
- Marketing Agent content generation
- Property-based tests for core invariants
- Integration tests for end-to-end workflows
- Documentation and deployment guide

**Acceptance Criteria**:
- Full project lifecycle completes without manual intervention
- QA Agent can reject and Dev Agent can rework
- Cost tracking accurate with 9Router fallback
- Marketing Agent generates announcement drafts
- Property tests pass for 100+ random scenarios
- Integration tests cover happy path and error cases
- Documentation enables new developers to contribute


## Design Decisions and Trade-offs

### 1. NestJS vs FastAPI for Backend

**Decision**: Use NestJS (Node.js/TypeScript)

**Rationale**:
- **Shared Language**: TypeScript across frontend and backend enables code sharing (types, utilities)
- **Dependency Injection**: NestJS's DI container simplifies agent service management and testing
- **WebSocket Integration**: First-class Socket.IO support for real-time features
- **Ecosystem**: Rich npm ecosystem for LLM SDKs (Anthropic, OpenAI), Docker client
- **Async/Await**: Native async model fits LLM API calls and queue processing

**Trade-offs**:
- Python (FastAPI) would have better LLM library ecosystem (LangChain, LlamaIndex)
- Python has stronger data science tools for future analytics features
- Node.js requires careful async error handling to prevent unhandled rejections

### 2. BullMQ vs Pure DAG Implementation

**Decision**: Use BullMQ for task queue + custom DAG engine for workflow logic

**Rationale**:
- **Separation of Concerns**: BullMQ handles job reliability, retries, concurrency; DAG engine handles workflow logic
- **Persistence**: BullMQ stores jobs in Redis for durability and recovery
- **Scalability**: Horizontal scaling by adding workers without code changes
- **Monitoring**: BullMQ provides built-in job metrics and admin UI

**Trade-offs**:
- Additional complexity of two orchestration layers
- Could use LangGraph.js for full workflow management, but adds heavy dependency
- Custom DAG engine requires thorough testing for edge cases

### 3. pgvector vs Dedicated Vector Database

**Decision**: Use PostgreSQL with pgvector extension

**Rationale**:
- **Simplicity**: Single database for relational data and vectors reduces operational complexity
- **ACID Guarantees**: Transactions ensure memory writes atomic with task updates
- **Cost**: No additional infrastructure or licensing costs
- **Performance**: pgvector sufficient for <100K memories per agent

**Trade-offs**:
- Dedicated vector DBs (Pinecone, Weaviate, Qdrant) offer better performance at scale
- Less mature vector indexing compared to specialized solutions
- May need migration to dedicated vector DB if memory count exceeds 1M


### 4. Docker Sandbox vs Other Isolation Methods

**Decision**: Use Docker containers for tool execution sandbox

**Rationale**:
- **Strong Isolation**: Kernel namespaces, cgroups, seccomp provide multiple security layers
- **Resource Control**: Hard limits on CPU, memory, disk enforceable via Docker API
- **Portability**: Works consistently across development and production environments
- **Ecosystem**: Mature tooling (dockerode) for container management from Node.js

**Trade-offs**:
- Docker daemon must be accessible (security consideration)
- Container startup latency (200-500ms per execution)
- Alternative: WebAssembly (WASM) would be faster but less ecosystem support
- Alternative: VM isolation (Firecracker) would be more secure but higher overhead

### 5. Zustand vs Redux Toolkit for Frontend State

**Decision**: Use Zustand for simple global state

**Rationale**:
- **Simplicity**: Less boilerplate than Redux Toolkit
- **Bundle Size**: Smaller bundle (~1KB vs ~10KB)
- **TypeScript**: Excellent TypeScript inference
- **Sufficient**: AI Corp doesn't need complex state middleware

**Trade-offs**:
- Redux DevTools more mature than Zustand devtools
- Redux Toolkit has larger community and ecosystem
- Zustand less standardized patterns (more flexibility = more inconsistency risk)

### 6. 9Router Integration Approach

**Decision**: Treat 9Router as primary with graceful fallback to direct provider

**Rationale**:
- **Cost Optimization**: 3-tier fallback can reduce costs by 50-80%
- **RTK Token Saver**: Automatic 20-40% token reduction for tool outputs
- **Reliability**: Circuit breaker ensures system continues when 9Router down
- **Flexibility**: Per-agent model routing allows mixing free and paid models

**Trade-offs**:
- Additional complexity of health checking and fallback logic
- 9Router is MITM proxy seeing all prompts (privacy consideration)
- Dependency on external tool (9Router must be deployed alongside AI Corp)
- Cost tracking more complex (must use actualModelUsed not requestedModel)


## Future Enhancements

### 1. Advanced Agent Capabilities

**Potential Additions**:
- **Architect Agent**: Designs system architecture before Dev Agent implements
- **DevOps Agent**: Handles deployment, infrastructure, and monitoring
- **Data Scientist Agent**: Performs data analysis and ML model training
- **Designer Agent**: Creates UI mockups and design systems
- **Security Agent**: Performs security audits and penetration testing

**Implementation Notes**:
- Each agent requires role-specific tools and system prompts
- Workflow definitions need to be extended to support new agent types
- Memory namespaces should be created for agent-specific learnings

### 2. Multi-Project Parallelization

**Enhancement**: Execute multiple projects concurrently with resource sharing

**Benefits**:
- Higher throughput for users with multiple projects
- Shared learnings across projects in same domain
- Better resource utilization (idle agents can work on other projects)

**Challenges**:
- Resource contention (LLM rate limits, Docker container limits)
- Memory isolation more critical to prevent cross-project contamination
- Requires sophisticated scheduling and priority queue

### 3. Agent Self-Improvement

**Enhancement**: Agents learn from successes/failures and improve over time

**Mechanism**:
- Analyze completed workflows to identify patterns
- Store successful strategies in long-term memory with high importance
- Adjust agent behavior based on accumulated learnings
- A/B testing different prompts and strategies

**Metrics**:
- Task success rate over time
- Cost per project over time
- Human intervention frequency


### 4. Visual Workflow Builder

**Enhancement**: Drag-and-drop UI for creating custom workflows

**Features**:
- Visual node editor for defining workflow DAG
- Configure agent tasks, conditions, and approval points
- Template library for common workflows
- Workflow validation with cycle detection
- Export/import workflow definitions

**Use Cases**:
- Custom development processes per project type
- Experimental workflows with different agent combinations
- Community-shared workflow templates

### 5. Agent Marketplace

**Enhancement**: Marketplace for custom agents and tools

**Concepts**:
- Users can create and share custom agent configurations
- Community-contributed tool definitions
- Rating and reviews for agents/tools
- One-click install to add agent to workspace
- Monetization for premium agent configurations

**Security Considerations**:
- Sandbox all community tools
- Code review process for marketplace submissions
- Reputation system to surface high-quality contributions

### 6. Integration Ecosystem

**Enhancement**: Connect to external services and tools

**Integrations**:
- **GitHub/GitLab**: Automatically create branches, PRs, and issues
- **Slack/Discord**: Send notifications and approval requests
- **Jira/Linear**: Sync tasks bidirectionally
- **Vercel/Netlify**: Deploy projects automatically
- **Sentry**: Monitor deployed applications
- **Stripe**: Handle billing for project costs

**Architecture**:
- Plugin system with standardized interface
- OAuth authentication for external services
- Webhook receivers for bidirectional sync
- Rate limiting and error handling per integration

