# Software Architecture Documentation

**Project:** AI-CORP Multi-Agent Platform  
**Document Type:** Architecture Design Specification  
**Version:** 1.0  
**Date:** December 2024  
**Author:** AI-CORP Development Team  
**Status:** Approved

---

## Table of Contents

1. [Introduction and Architecture Goals](#1-introduction-and-architecture-goals)
2. [Architecture Style](#2-architecture-style)
3. [Layer Descriptions](#3-layer-descriptions)
4. [Architecture Decision Records (ADRs)](#4-architecture-decision-records-adrs)
5. [Component Interactions and Data Flow](#5-component-interactions-and-data-flow)
6. [Security Architecture](#6-security-architecture)
7. [Scalability Considerations](#7-scalability-considerations)
8. [Technology Stack](#8-technology-stack)

---

## 1. Introduction and Architecture Goals

### 1.1 Purpose

This document provides a comprehensive description of the software architecture for the **AI-CORP Multi-Agent Platform** — a system for automating enterprise software development workflows using coordinated AI agents. It is intended to serve as the authoritative architectural reference for the graduation thesis *"Design and Development of a Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation"*.

The architecture documentation covers structural decisions, rationale behind technology choices, component interactions, security design, and scalability considerations. All decisions are aligned with academic Object-Oriented Analysis and Design (OOAD) principles and documented using UML 2.5 notation.

### 1.2 System Context

The AI-CORP platform operates in the domain of AI-assisted software project management. It provides:

- **Automated multi-agent workflows**: A DAG-based engine orchestrates 8+ specialized AI agents (CEO, PM, DEV, QA, Marketing, BA, Architect, DevOps).
- **Human-in-the-loop governance**: Board members approve critical workflow steps before execution proceeds.
- **Real-time visibility**: WebSocket-based live updates to a React dashboard showing agent activities, Kanban boards, and cost dashboards.
- **LLM-agnostic inference**: A unified gateway routes LLM requests to multiple providers (OpenAI, Anthropic, Gemini) with circuit breaker protection.
- **Secure code execution**: DEV and QA agents execute code in isolated Docker sandbox containers.

### 1.3 Architecture Goals

| Goal | Description | Priority |
|------|-------------|----------|
| **Modularity** | Each bounded context (agents, workflow, projects) is encapsulated in its own NestJS module with clear interfaces | High |
| **Testability** | Domain logic is isolated from infrastructure, enabling unit testing without database or network | High |
| **Extensibility** | New agent types and LLM providers can be added without modifying existing code (Open/Closed Principle) | High |
| **Reliability** | Circuit breakers, retry logic, and state machines prevent cascading failures | High |
| **Security** | Authentication, authorization, input sanitization, and sandbox isolation are enforced at every layer | High |
| **Observability** | All state transitions, API calls, and errors are logged and exposed via health endpoints | Medium |
| **Cost Control** | Token usage is tracked per agent/project/model with budget enforcement | Medium |
| **Performance** | Async job queue (BullMQ) prevents blocking; vector search enables sub-100ms memory recall | Medium |

### 1.4 Architectural Constraints

1. **Technology Constraint**: Backend must use NestJS (TypeScript); Frontend must use React.
2. **Budget Constraint**: LLM usage must be cost-tracked; free models preferred via 9Router gateway.
3. **Academic Constraint**: Architecture must demonstrate OOAD principles, design patterns, and SOLID compliance for thesis evaluation.
4. **Security Constraint**: Code execution must occur in isolated Docker containers; no prompt injection allowed.
5. **Timeline Constraint**: MVP must be demo-ready by December 2024.

---

## 2. Architecture Style

### 2.1 Primary Architecture: Layered Architecture with DDD

The AI-CORP system is built on a **Layered Architecture** (also known as N-Tier Architecture) combined with principles from **Domain-Driven Design (DDD)**. This combination was chosen because:

1. **Layered Architecture** provides clear separation of concerns, with each layer having a single responsibility and only depending on the layer directly below it.
2. **Domain-Driven Design** ensures that the business domain (agents, workflows, projects, approvals) is modeled explicitly and not polluted by infrastructure concerns.

```
┌─────────────────────────────────────────────────────────┐
│              Presentation Layer                          │
│   REST Controllers + WebSocket Gateway + DTOs            │
├─────────────────────────────────────────────────────────┤
│              Application Layer                           │
│   Services + Use Cases + Agent Orchestration             │
├─────────────────────────────────────────────────────────┤
│              Domain Layer                                │
│   Entities + Aggregates + Domain Events + Interfaces     │
├─────────────────────────────────────────────────────────┤
│              Infrastructure Layer                        │
│   Repositories + LLM Providers + Queue + Security        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Complementary Patterns

Beyond layered architecture, several supplementary patterns are applied:

| Pattern | Application |
|---------|-------------|
| **Repository Pattern** | Data access abstraction (domain interfaces, Prisma implementations) |
| **Factory Method Pattern** | Agent creation (AgentFactory) and LLM provider creation (LLMFactory) |
| **Strategy Pattern** | Agent reasoning strategies, LLM provider selection, review strategies |
| **Observer Pattern** | Domain event notifications, WebSocket state broadcasts |
| **State Pattern** | Agent/Workflow/Task/Approval lifecycle management |
| **Circuit Breaker Pattern** | LLM failure protection |
| **Command Pattern** | Agent actions (encapsulated as command objects) |
| **Decorator Pattern** | NestJS guards (JWT, RBAC) decorating controllers |
| **Facade Pattern** | Application services exposing simplified interfaces |

### 2.3 Dependency Rule

The **Dependency Inversion Principle** (SOLID-D) is strictly enforced:

- **Domain Layer** has zero external dependencies (no framework imports, no ORM imports)
- **Application Layer** depends on Domain interfaces, not Infrastructure implementations
- **Infrastructure Layer** implements Domain interfaces (constructor injection via NestJS DI)
- **Presentation Layer** depends on Application services only

This is enforced through:
1. TypeScript interfaces defined in Domain layer
2. NestJS `@Injectable()` DI resolves concrete implementations at runtime
3. Import rules checked via ESLint (no cross-layer imports)

---

## 3. Layer Descriptions

### 3.1 Domain Layer

**Location:** `apps/api/src/domain/`

The Domain Layer is the core of the application and contains:

#### 3.1.1 Entities

Entities are objects with a distinct identity that persists across state changes.

```typescript
// Example: AgentEntity (Domain Layer)
export class AgentEntity extends Entity<AgentProps> {
  private stateMachine: AgentStateMachine;
  
  get role(): AgentRole { return this.props.role; }
  get state(): AgentState { return this.stateMachine.currentState; }
  
  assignTask(task: Task): void {
    this.stateMachine.transitionTo(AgentState.THINKING);
    this.addDomainEvent(new TaskAssignedEvent(this.id, task.id));
  }
}
```

**Key Entities:**
- `AgentEntity` — AI agent with role, state machine, and configuration
- `ProjectAggregateRoot` — Project with tasks, milestones, budget
- `WorkflowRunEntity` — Active workflow execution with DAG state
- `TaskEntity` — Individual development task on Kanban board
- `ApprovalEntity` — Human approval request with status

#### 3.1.2 Value Objects

Value Objects are immutable objects defined by their attributes, not identity.

- `AgentRole` — Enum: CEO, PM, DEV, QA, MARKETING, BA, ARCHITECT, DEVOPS
- `WorkflowNodeVO` — Node definition (type, agent, config, edges)
- `CostRecord` — Token usage + cost calculation
- `EmbeddingVector` — 1536-dimension float array for semantic search

#### 3.1.3 Domain Events

Domain Events capture significant business occurrences:

```typescript
// Domain events emitted by aggregates
class TaskAssignedEvent extends DomainEvent { }
class WorkflowNodeCompletedEvent extends DomainEvent { }
class ApprovalRequestedEvent extends DomainEvent { }
class BudgetThresholdExceededEvent extends DomainEvent { }
```

#### 3.1.4 Repository Interfaces

Domain defines what it needs; Infrastructure provides it:

```typescript
export interface IAgentRepository {
  findById(id: string): Promise<AgentEntity | null>;
  findByRole(role: AgentRole): Promise<AgentEntity | null>;
  save(agent: AgentEntity): Promise<void>;
  findAll(): Promise<AgentEntity[]>;
}
```

### 3.2 Application Layer

**Location:** `apps/api/src/modules/`

The Application Layer orchestrates use cases using Domain entities and Infrastructure services.

#### 3.2.1 Application Services

```
AgentService          — CRUD for agent configuration, model selection
AgentRegistryService  — Pool of active agents, lookup by role
WorkflowEngineService — Start/pause/resume/cancel workflow runs
ProjectService        — Project CRUD, status management
TaskService           — Kanban task lifecycle management
ApprovalService       — Handle approval requests and decisions
OrchestratorService   — Coordinate agent assignment to workflow nodes
CostTrackerService    — Record LLM usage, enforce budgets
AuthService           — JWT issuance, user authentication
```

#### 3.2.2 Agent Classes

Each agent class implements a common interface but overrides role-specific behavior:

```typescript
abstract class BaseAgent {
  abstract getSystemPrompt(): string;
  abstract processTask(task: Task): Promise<AgentResult>;
  
  protected async think(context: TaskContext): Promise<ExecutionPlan> {
    return this.llmService.generate(this.getSystemPrompt(), context);
  }
  
  protected async act(plan: ExecutionPlan): Promise<AgentResult> {
    // Execute actions in plan
  }
}

class DEVAgent extends BaseAgent {
  async processTask(task: Task): Promise<AgentResult> {
    const plan = await this.think({ task, codebase: await this.memoryService.search(task) });
    const code = await this.toolRegistry.execute('code_generator', plan);
    return this.act({ code, tests: await this.generateTests(code) });
  }
}
```

### 3.3 Infrastructure Layer

**Location:** `apps/api/src/modules/{llm,memory,tools,security}/` and `apps/api/src/prisma/`

The Infrastructure Layer implements all technical concerns:

#### 3.3.1 Persistence (Repository Implementations)

```typescript
// Prisma implementation of domain interface
@Injectable()
export class PrismaAgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}
  
  async findById(id: string): Promise<AgentEntity | null> {
    const data = await this.prisma.agent.findUnique({ where: { id } });
    return data ? AgentMapper.toDomain(data) : null;
  }
  
  async save(agent: AgentEntity): Promise<void> {
    const data = AgentMapper.toPersistence(agent);
    await this.prisma.agent.upsert({ where: { id: data.id }, create: data, update: data });
  }
}
```

#### 3.3.2 LLM Module

The LLM module abstracts all AI model interactions:

```
LLMFactory → creates → OpenAIProvider | AnthropicProvider
                    → protected by → CircuitBreaker
                    → routed through → 9Router Gateway
```

Key features:
- **Abstract Factory Pattern** for provider creation
- **Circuit Breaker** opens after 3 consecutive failures, resets after 30s
- **Cost Tracking** records tokens used per request
- **Graceful Degradation** returns cached response when LLM unavailable

#### 3.3.3 Messaging (BullMQ)

```
WorkflowEngine → enqueue job → BullMQ Queue (Redis)
BullMQ Worker → consume job → NodeExecutorService → AgentOrchestratorService
```

Job persistence ensures workflow steps survive server restarts.

#### 3.3.4 Memory Module

Semantic memory using vector embeddings:

```
MemoryService → generate embedding → EmbeddingService (LLM)
              → store vector → PostgreSQL (pgvector)
              → cosine similarity search → VectorSearchService
```

Agents use memory to recall relevant past decisions and code patterns.

### 3.4 Presentation Layer

**Location:** `apps/api/src/modules/{auth,projects,agents,workflow,approvals,cost}/controllers/` and `apps/api/src/modules/websocket/`

#### 3.4.1 REST Controllers

All controllers follow a consistent pattern:
- `@UseGuards(JwtAuthGuard, RolesGuard)` for authentication
- Input validation via class-validator DTOs
- Service delegation (no business logic in controllers)
- Swagger documentation via `@ApiOperation`, `@ApiResponse`

#### 3.4.2 WebSocket Gateway

```typescript
@WebSocketGateway({ cors: { origin: '*' } })
export class AppWebSocketGateway {
  @SubscribeMessage('join_project')
  handleJoinProject(@MessageBody() dto: JoinProjectDto) {
    this.server.socketsJoin(`project:${dto.projectId}`);
  }
  
  broadcastStateChange(projectId: string, event: DomainEvent) {
    this.server.to(`project:${projectId}`).emit('state_change', event);
  }
}
```

Events broadcast in real-time:
- `agent.state_change` — Agent status updates
- `workflow.node.completed` — Node execution complete
- `approval.requested` — New approval gate reached
- `task.status_changed` — Kanban card moved
- `cost.budget_alert` — Budget threshold reached

---

## 4. Architecture Decision Records (ADRs)

Architecture Decision Records document significant technical choices made during development.

---

### ADR-001: Backend Framework — NestJS

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | October 2024 |
| **Deciders** | Development Team |

**Context:**  
The backend requires a TypeScript framework that supports modular architecture, dependency injection, WebSocket, and job queues. Options considered: Express.js (plain), Fastify, NestJS.

**Decision:**  
Use **NestJS 10** as the primary backend framework.

**Rationale:**
1. **Modularity**: NestJS enforces module-based architecture matching the bounded context design.
2. **Dependency Injection**: Built-in DI container enables Dependency Inversion Principle without external tools.
3. **Decorator-based**: Guards, Interceptors, and Pipes implement cross-cutting concerns cleanly (Decorator pattern).
4. **TypeScript-first**: Full TypeScript support with strict mode for type safety.
5. **Ecosystem**: Official modules for BullMQ, WebSocket, JWT, Prisma — no integration glue needed.
6. **Academic alignment**: NestJS patterns (modules, providers, controllers) map cleanly to OOAD concepts.

**Consequences:**
- Pro: Reduced boilerplate, consistent module structure, rich ecosystem
- Con: Higher initial learning curve; opinionated structure requires discipline
- Con: Startup time slightly higher than plain Express

---

### ADR-002: Database — PostgreSQL 16 with pgvector

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | October 2024 |
| **Deciders** | Development Team |

**Context:**  
The system requires both relational data storage (projects, tasks, agents) and vector embedding storage for agent memory. Options considered: PostgreSQL + separate Qdrant, MongoDB Atlas (vector search), pure PostgreSQL with pgvector.

**Decision:**  
Use **PostgreSQL 16 with pgvector extension** for all data storage.

**Rationale:**
1. **Unified storage**: Single database for relational and vector data reduces operational complexity.
2. **pgvector**: Provides IVFFlat and HNSW indexes for efficient cosine similarity search.
3. **Prisma ORM**: Full PostgreSQL support with type-safe queries and migration management.
4. **ACID guarantees**: Critical for approval and cost tracking workflows.
5. **pgvector performance**: 1536-dimension embeddings with cosine similarity search at ~50ms for 10K vectors.

**Consequences:**
- Pro: No external vector database service required
- Pro: Transactional consistency across relational and vector data
- Con: pgvector performance degrades beyond 1M vectors (not a concern at thesis scale)
- Con: Requires pgvector installation (handled via Docker image `pgvector/pgvector:pg16`)

---

### ADR-003: Job Queue — BullMQ with Redis

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | October 2024 |
| **Deciders** | Development Team |

**Context:**  
Workflow node execution is asynchronous and must survive server restarts. Options considered: In-process EventEmitter, RabbitMQ, Kafka, BullMQ.

**Decision:**  
Use **BullMQ** (backed by Redis 7) for workflow job queuing.

**Rationale:**
1. **Persistence**: BullMQ jobs survive server restarts (stored in Redis).
2. **Retry logic**: Built-in exponential backoff with configurable attempts.
3. **Priority queues**: High-priority workflow nodes can be processed first.
4. **Concurrency control**: `concurrency` option limits parallel workflow executions.
5. **Monitoring**: BullMQ Dashboard (Bull Board) provides visual job monitoring.
6. **NestJS integration**: `@nestjs/bullmq` package provides first-class module support.

**Consequences:**
- Pro: Reliable async execution with automatic retry
- Pro: Redis also used for session cache and pub/sub (dual purpose)
- Con: Redis dependency increases infrastructure complexity
- Con: Redis single-point-of-failure (mitigated by Redis Sentinel in production)

---

### ADR-004: Data Access Pattern — Repository Pattern

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | October 2024 |
| **Deciders** | Development Team |

**Context:**  
Domain entities must be persisted to PostgreSQL without coupling domain logic to the ORM (Prisma). Direct Prisma usage in domain/application services would violate DDD and SOLID principles.

**Decision:**  
Implement the **Repository Pattern** with domain-defined interfaces and infrastructure-layer Prisma implementations.

**Rationale:**
1. **Dependency Inversion**: Application services depend on `IAgentRepository` interface, not `PrismaAgentRepository`.
2. **Testability**: Unit tests mock repository interfaces without database connections.
3. **Replaceability**: Switching from Prisma to TypeORM requires changing only repository implementations.
4. **Domain purity**: Domain entities remain free of `@PrismaClient()` or `@Column()` decorators.
5. **Mapper pattern**: `AgentMapper.toDomain()` / `AgentMapper.toPersistence()` translate between domain and persistence models.

**Consequences:**
- Pro: Complete separation of domain model from persistence model
- Pro: Highly testable application services
- Con: Additional mapper code (domain model ↔ persistence model)
- Con: Slight overhead compared to direct ORM usage (negligible)

---

### ADR-005: Agent Specialization — Strategy Pattern

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | October 2024 |
| **Deciders** | Development Team |

**Context:**  
Eight specialized agent roles (CEO, PM, DEV, QA, Marketing, BA, Architect, DevOps) share common infrastructure (LLM access, memory, tools) but differ in system prompts, tool access, and task processing logic. Options considered: switch/case on role, separate independent classes, inheritance hierarchy with Strategy.

**Decision:**  
Use a **Strategy Pattern** with `BaseAgent` abstract class and role-specific concrete classes.

**Rationale:**
1. **Open/Closed Principle**: New agent types added by creating new class, not modifying `BaseAgent`.
2. **Single Responsibility**: Each agent class responsible for one role's reasoning strategy.
3. **Code reuse**: `BaseAgent` provides `think()`, `act()`, `useTool()` infrastructure.
4. **Runtime strategy selection**: `AgentFactory` creates the appropriate strategy at runtime.
5. **Testability**: Each agent strategy testable in isolation.

**Consequences:**
- Pro: Easy to add new agent types
- Pro: Role-specific behavior cleanly encapsulated
- Con: Abstract class creates tighter coupling than pure interface approach
- Con: Inheritance depth must be kept shallow (max 2 levels)

---

### ADR-006: Domain Events for Cross-Module Communication

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | November 2024 |
| **Deciders** | Development Team |

**Context:**  
Multiple modules need to react to state changes (e.g., task completion triggers cost recording, agent state change triggers WebSocket broadcast). Direct service-to-service calls would create tight coupling.

**Decision:**  
Use **Domain Events** with NestJS `EventEmitter2` for decoupled cross-module communication.

**Rationale:**
1. **Loose coupling**: Emitter doesn't know about subscribers (Observer Pattern).
2. **Single Responsibility**: Each subscriber handles one concern (cost tracking, WebSocket, PM notification).
3. **Extensibility**: New subscribers added without modifying event emitters.
4. **Domain expressiveness**: Events (`TaskCompletedEvent`, `ApprovalRequestedEvent`) are meaningful domain concepts.
5. **Async execution**: `EventEmitter2` supports async handlers for non-blocking processing.

**Consequences:**
- Pro: Highly decoupled module interactions
- Pro: Easy to add new cross-cutting behaviors
- Con: Event flow harder to trace than direct calls (mitigated by structured logging)
- Con: Error handling in async event handlers requires explicit error boundaries

---

## 5. Component Interactions and Data Flow

### 5.1 Primary Data Flow: Project Creation and Workflow Execution

```
User (Browser)
    │ POST /projects
    ▼
ProjectsController
    │ validates DTO
    ▼
ProjectService
    │ creates ProjectAggregateRoot
    │ raises ProjectCreatedEvent
    ▼
WorkflowEngineService (reacts to event)
    │ initializes default workflow DAG
    │ enqueues first node → BullMQ
    ▼
BullMQ Worker
    │ dequeues job
    ▼
NodeExecutorService
    │ identifies node type (agent_task)
    ▼
OrchestratorService
    │ looks up CEO agent in AgentRegistry
    │ calls CEOAgent.processTask()
    ▼
CEOAgent (Strategy)
    │ calls LLMService.generate(systemPrompt, context)
    ▼
LLMService → CircuitBreaker → 9Router Gateway → LLM Provider
    │ response: milestones JSON
    ▼
CEOAgent
    │ creates Milestone entities
    │ raises WorkflowNodeCompletedEvent
    ▼
WorkflowEngineService (reacts to event)
    │ determines next node (PM task)
    │ enqueues next job
    ▼
WebSocketGateway (reacts to same event)
    │ broadcasts to project room
    ▼
React Frontend
    │ updates Virtual Office UI
```

### 5.2 Human Approval Flow

```
NodeExecutorService
    │ identifies node type = "human_approval"
    ▼
ApprovalService
    │ creates Approval entity (PENDING state)
    │ sends WebSocket notification to board members
    ▼
Board Member (Browser)
    │ sees ApprovalModal with context
    │ clicks "Approve"
    │ POST /approvals/:id { decision: "approved" }
    ▼
ApprovalsController
    ▼
ApprovalService
    │ validates role == 'board_member'
    │ ApprovalStateMachine.transition(APPROVED)
    │ raises ApprovalDecisionEvent
    ▼
WorkflowEngineService (reacts to event)
    │ traverses "onApprove" edge in DAG
    │ enqueues next node
    ▼
WebSocketGateway
    │ broadcasts approval decision
```

### 5.3 Code Execution Data Flow

```
DEVAgent
    │ plan: create file "api.ts" with content
    ▼
ToolRegistryService
    │ routes to SandboxExecutorService
    ▼
SandboxExecutorService
    │ docker run node:18-alpine --user=1001
    │ --network=none --memory=256m
    │ --security-opt seccomp=profile.json
    │ executes code in isolated container
    │ captures stdout/stderr
    │ destroys container
    ▼
DEVAgent
    │ receives execution result
    │ includes in AgentResult
    ▼
NodeExecutorService
    │ persists result
    │ raises WorkflowNodeCompletedEvent
```

---

## 6. Security Architecture

### 6.1 Authentication

The system uses **JWT (JSON Web Token)** authentication:

1. User submits credentials to `POST /auth/login`
2. `AuthService` validates against bcrypt-hashed password in PostgreSQL
3. JWT issued with 24-hour expiry, signed with `JWT_SECRET`
4. Client includes `Authorization: Bearer <token>` in all requests
5. `JwtAuthGuard` validates token on every protected endpoint
6. Token revocation via Redis blacklist (on logout)

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    if (result) {
      const token = this.extractToken(context);
      if (await this.redisService.isBlacklisted(token)) {
        throw new UnauthorizedException('Token revoked');
      }
    }
    return result;
  }
}
```

### 6.2 Role-Based Access Control (RBAC)

Two roles are enforced:

| Role | Capabilities |
|------|-------------|
| `admin` | Full system access: manage agents, users, view all logs, configure LLM models |
| `board_member` | Project management: create projects, approve/reject workflow steps, view cost dashboards |

RBAC is implemented via `@Roles('admin')` decorator + `RolesGuard`:

```typescript
@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  @Put(':id/model')
  @Roles('admin')           // Only admin can change LLM model
  updateModel(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.agentService.updateModel(id, dto);
  }
}
```

### 6.3 Input Sanitization

The `InputSanitizerService` prevents prompt injection attacks:

```typescript
// 15+ patterns detected and blocked
const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /you are now a/i,
  /act as (a )?different/i,
  /system prompt/i,
  /reveal your instructions/i,
  // ... more patterns
];
```

All user-provided text that will be sent to LLM APIs passes through sanitization before processing.

### 6.4 Sandbox Isolation

Code execution is isolated via Docker with multiple security layers:

| Security Measure | Implementation |
|-----------------|----------------|
| **Network isolation** | `--network=none` flag; no internet access from sandbox |
| **User isolation** | `--user=1001` non-root execution |
| **Syscall filtering** | Custom seccomp profile blocks dangerous system calls |
| **Memory limit** | `--memory=256m` prevents memory exhaustion attacks |
| **CPU limit** | `--cpus=0.5` prevents CPU starvation |
| **Timeout** | 30-second execution timeout; container killed on timeout |
| **Filesystem** | Read-only filesystem except `/tmp`; no persistent storage |
| **Container lifecycle** | Container destroyed immediately after execution |

### 6.5 Environment Security

`EnvValidator` service validates all required environment variables at startup:

```typescript
@Injectable()
export class EnvValidator implements OnModuleInit {
  onModuleInit() {
    const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'LLM_GATEWAY_URL'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
  }
}
```

---

## 7. Scalability Considerations

### 7.1 Current Architecture (Thesis / Single-Node)

The current deployment targets a single Docker Compose environment suitable for thesis demonstration:

- Single API server instance (NestJS)
- Single BullMQ worker process
- Single PostgreSQL instance
- Single Redis instance

This supports ~10 concurrent workflow executions and ~100 concurrent WebSocket connections.

### 7.2 Horizontal Scaling Path

The architecture is designed to scale horizontally with minimal changes:

**API Server Scaling:**
```
Load Balancer (Nginx)
  ├── API Server Instance 1 (Port 3001)
  ├── API Server Instance 2 (Port 3002)
  └── API Server Instance 3 (Port 3003)
```

Enabled by:
- Stateless JWT authentication (no server-side session)
- Redis-backed session blacklist (shared across instances)
- Socket.IO Redis Adapter for multi-instance WebSocket broadcasting

**BullMQ Worker Scaling:**
```
Redis Queue (shared)
  ├── Worker Instance 1 (concurrency: 5)
  ├── Worker Instance 2 (concurrency: 5)
  └── Worker Instance 3 (concurrency: 5)
```

BullMQ distributes jobs across all worker instances automatically.

**Database Scaling:**
- Read replicas for non-critical queries (agent logs, cost history)
- pgvector HNSW index for O(log n) vector search
- Connection pooling via PgBouncer

### 7.3 Performance Characteristics

| Operation | Current Performance | Target (Production) |
|-----------|--------------------|--------------------|
| REST API response | < 50ms (p95) | < 100ms (p95) |
| WebSocket event broadcast | < 10ms | < 20ms |
| Vector similarity search | < 100ms (10K vectors) | < 200ms (1M vectors) |
| BullMQ job dispatch | < 5ms | < 10ms |
| LLM request (9Router) | 1–5s (model dependent) | 1–10s |
| Sandbox code execution | 5–30s | 5–60s |

### 7.4 Caching Strategy

| Data Type | Cache Location | TTL | Invalidation |
|-----------|---------------|-----|--------------|
| Agent configurations | In-memory (NestJS) | Process lifetime | On config update |
| JWT blacklist | Redis | JWT expiry time | N/A (TTL-based) |
| LLM responses (identical prompts) | Redis | 1 hour | On cache miss |
| Vector embeddings | PostgreSQL (persistent) | Forever | On content update |
| WebSocket room memberships | Socket.IO (in-memory) | Connection lifetime | On disconnect |

---

## 8. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | React | 18.2 | UI component library |
| **Build Tool** | Vite | 5.x | Fast frontend bundling |
| **Frontend Language** | TypeScript | 5.x | Type-safe frontend code |
| **UI Component Library** | Ant Design | 5.x | Enterprise UI components |
| **State Management** | Zustand | 4.x | Lightweight global state |
| **HTTP Client** | React Query (TanStack) | 5.x | Async data fetching + caching |
| **WebSocket Client** | Socket.IO Client | 4.x | Real-time communication |
| **Backend Framework** | NestJS | 10.x | Modular Node.js framework |
| **Backend Language** | TypeScript | 5.x | Type-safe backend code |
| **ORM** | Prisma | 5.x | Type-safe database access |
| **Database** | PostgreSQL | 16 | Relational + vector storage |
| **Vector Extension** | pgvector | 0.7.x | Semantic search embeddings |
| **Cache / Queue** | Redis | 7-alpine | BullMQ + session cache |
| **Job Queue** | BullMQ | 5.x | Async workflow job queue |
| **Authentication** | Passport + JWT | — | JWT-based auth |
| **Password Hashing** | bcrypt | — | Secure password storage |
| **Validation** | class-validator | — | DTO input validation |
| **Real-time** | Socket.IO | 4.x | WebSocket + long-polling |
| **LLM Gateway** | 9Router / OpenCode | — | LLM request routing |
| **Code Sandbox** | Docker | 24.x | Isolated code execution |
| **Container Image** | node:18-alpine | 18 | Lightweight sandbox |
| **Monorepo** | pnpm workspaces | 8.x | Package management |
| **Build System** | Turborepo | 1.x | Monorepo build cache |
| **Linting** | ESLint | 8.x | Code quality enforcement |
| **Formatting** | Prettier | 3.x | Code formatting |

---

*This document is part of the AI-CORP Multi-Agent Platform graduation thesis documentation.*  
*See also: `docs/diagrams/architecture/` for UML architecture diagrams.*  
*Reference: `docs/design/state-machines.md` for state machine design documentation.*
