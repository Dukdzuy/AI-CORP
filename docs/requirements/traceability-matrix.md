# Requirements Traceability Matrix — AI-CORP Multi-Agent Platform

| **Field** | **Value** |
|-----------|-----------|
| **Document Version** | 1.0.0 |
| **Date** | December 10, 2024 |
| **Authors** | AI-CORP Development Team |
| **Status** | Draft - Under Review |
| **Project** | Design and Development of a Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation |

---

## 1. Overview

This Requirements Traceability Matrix (RTM) establishes bidirectional traceability between:
- **Functional Requirements** → **Use Cases** → **Design Artifacts** → **Implementation Files** → **Test Cases**
- **Non-Functional Requirements** → **Architecture Decisions** → **Design Patterns** → **Implementation** → **Test Cases**

The RTM ensures every requirement is implemented, tested, and verifiable, satisfying academic standards for thesis documentation and enabling impact analysis for future changes.

---

## 2. Subsystem Organization

Requirements are organized into 7 subsystems:

1. **Authentication & Authorization (AUTH)** - User login, JWT tokens, RBAC
2. **Project Management (PROJ)** - Projects, milestones, tasks, Kanban
3. **Agent Framework (AGENT)** - Base agent architecture, 8 specialized agents, memory system
4. **Workflow Orchestration (WF)** - DAG execution engine, state management, recovery
5. **Approval System (APPR)** - Human-in-the-loop, approval state machine
6. **Cost Tracking (COST)** - API usage logging, budget monitoring, cost analytics
7. **Memory & Learning (MEM)** - Vector embeddings, semantic search, memory management

---

## 3. Functional Requirements Traceability

### 3.1 Authentication & Authorization Subsystem

| Req ID | Requirement Name | Description | Use Case IDs | Design Artifacts | Implementation Files | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|---------------------|----------|--------|
| FR-AUTH-001 | User Authentication | System shall authenticate users via email/password and issue JWT tokens | UC-001 | Class: AuthService, JwtStrategy | apps/api/src/modules/auth/auth.service.ts, apps/api/src/modules/auth/jwt.strategy.ts | TEST-AUTH-001, TEST-AUTH-002 | Implemented |
| FR-AUTH-002 | Password Security | System shall hash passwords using bcrypt with salt rounds ≥12 | UC-001 | Class: AuthService (register method) | apps/api/src/modules/auth/auth.service.ts | TEST-AUTH-003 | Implemented |
| FR-AUTH-003 | Role-Based Access Control | System shall enforce RBAC with roles: admin, board_member | UC-003, UC-008 | Guard: RolesGuard, Decorator: @Roles() | apps/api/src/modules/auth/roles.guard.ts | TEST-AUTH-004, TEST-AUTH-005 | Implemented |
| FR-AUTH-004 | JWT Token Expiry | System shall expire JWT tokens after 24 hours | UC-001 | JwtModule configuration | apps/api/src/modules/auth/auth.module.ts | TEST-AUTH-006 | Implemented |

### 3.2 Project Management Subsystem

| Req ID | Requirement Name | Description | Use Case IDs | Design Artifacts | Implementation Files | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|---------------------|----------|--------|
| FR-PROJ-001 | Create Project | Board Member shall create projects with name, description, goal, budget | UC-002 | Class: ProjectApplicationService (createProject) → Project.create | apps/api/src/modules/projects/project-application.service.ts, apps/api/src/domain/entities/Project.ts | TEST-PROJ-001, TEST-PROJ-002 | Implemented |
| FR-PROJ-002 | Project Validation | System shall validate project name (3-200 chars), description (<2000 chars), budget (≥0) | UC-002 | DTO: CreateProjectDto with class-validator decorators | apps/api/src/modules/projects/dto/create-project.dto.ts | TEST-PROJ-003 | Implemented |
| FR-PROJ-003 | Project Uniqueness | System shall enforce unique project names per user | UC-002 | Database unique constraint on (createdById, name) | apps/api/prisma/schema.prisma | TEST-PROJ-004 | Planned |
| FR-PROJ-004 | Milestone Management | CEO Agent shall create 2-4 high-level milestones per project | UC-016 | Class: CeoAgent (act method) | apps/api/src/modules/agents/ceo.agent.ts | TEST-AGENT-CEO-001 | Implemented |
| FR-PROJ-005 | Task Breakdown | PM Agent shall break milestones into 5-20 granular tasks | UC-011 | Class: PmAgent (act method) | apps/api/src/modules/agents/pm.agent.ts | TEST-AGENT-PM-001 | Implemented |
| FR-PROJ-006 | Kanban Status Management | System shall enforce Kanban transitions: todo→in_progress→review→done | UC-020 | Class: TaskApplicationService (updateTask) → Task.transitionTo / TaskStatus | apps/api/src/modules/projects/task-application.service.ts, apps/api/src/domain/entities/Task.ts | TEST-PROJ-005, TEST-PROJ-006 | Implemented |
| FR-PROJ-007 | Budget Tracking | System shall track project.costAccrued and prevent exceeding budget | UC-002, UC-008, UC-011 | Class: ProjectApplicationService (accrueCost) → Project.accrueCost | apps/api/src/modules/projects/project-application.service.ts, apps/api/src/domain/entities/Project.ts | TEST-PROJ-007 | Implemented |

### 3.3 Agent Framework Subsystem

| Req ID | Requirement Name | Description | Use Case IDs | Design Artifacts | Implementation Files | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|---------------------|----------|--------|
| FR-AGENT-001 | BA Agent - Requirements Analysis | BA Agent shall analyze project goals and generate requirements documents (FR/NFR lists, use case outlines) | UC-009 | Class: BaAgent, BAActionStrategy (UseCaseDataSchema), BA_PROFILE | apps/api/src/modules/agents/ba.agent.ts | apps/api/tests/unit/agents/agent-strategies.spec.ts, apps/api/tests/unit/agents/ooad-artifacts.spec.ts | Implemented |
| FR-AGENT-002 | Architect Agent - System Design | Architect Agent shall design system architecture, generate PlantUML diagrams, and create ADRs | UC-010 | Class: ArchitectAgent, ArchitectActionStrategy, OOADArtifactService, ARCHITECT_PROFILE | apps/api/src/modules/agents/architect.agent.ts | apps/api/tests/unit/agents/agent-strategies.spec.ts, apps/api/tests/unit/agents/ooad-artifacts.spec.ts | Implemented |
| FR-AGENT-003 | QC Agent - Use Case Verification | QC Agent shall derive acceptance tests from use cases and maintain the traceability matrix with coverage (replaces DevOps, 2026-10-26) | UC-016 | Class: QcAgent, QcActionStrategy, TraceabilityService | apps/api/src/modules/agents/qc.agent.ts | apps/api/tests/unit/agents/traceability.spec.ts, apps/api/tests/unit/agents/agent-strategies.spec.ts | Implemented |
| FR-AGENT-004 | Base Agent Architecture | All agents shall extend BaseAgent, which runs the injected thinking/action strategies in one execute() flow (Template Method + Strategy) | UC-004, UC-009-016 | Abstract Class: BaseAgent<TOutput> implements IAgent; RoleProfile | apps/api/src/modules/agents/base.agent.ts | apps/api/tests/unit/agents/base-agent.spec.ts | Implemented |
| FR-AGENT-005 | Agent State Management | Agents shall transition through states: IDLE→THINKING→ACTING→COMPLETED (State pattern) | UC-004 | Class: AgentStateMachine, Interface: IAgent | apps/api/src/domain/agent/AgentStateMachine.ts, apps/api/src/modules/agents/base.agent.ts | tests/unit/domain/agent/AgentStateMachine.spec.ts, apps/api/tests/unit/agents/base-agent.spec.ts | Implemented |
| FR-AGENT-006 | Agent Memory Storage | Agents shall save observations to AgentMemory with importance [1-10] and namespace | UC-017 | Class: MemoryService (saveMemory method) | apps/api/src/modules/memory/memory.service.ts | TEST-MEM-001, TEST-MEM-002 | Implemented |
| FR-AGENT-007 | Agent Memory Search | Agents shall search memories using semantic similarity (pgvector cosine distance) | UC-017, UC-009-016 | Class: MemoryService (searchMemories method) | apps/api/src/modules/memory/memory.service.ts | TEST-MEM-003, TEST-MEM-004 | Implemented |
| FR-AGENT-008 | LLM Integration | Agent strategies shall call the LLM through AgentLLMService (role model from Agent Settings or RoleProfile default, usage costed per project) | UC-018 | Class: AgentLLMService (Facade), UsageTrackingLLMProvider (Decorator), LLMProviderFactory | apps/api/src/modules/agents/services/agent-llm.service.ts, apps/api/src/modules/llm/usage-tracking.provider.ts | TEST-LLM-001, TEST-LLM-002 | Implemented |
| FR-AGENT-009 | Sandbox Execution | Agents shall execute tools in isolated Docker containers with resource limits | UC-012, UC-028 | Class: SandboxExecutor | apps/api/src/modules/tools/sandbox.executor.ts | TEST-SANDBOX-001, TEST-SANDBOX-002 | Implemented |
| FR-AGENT-010 | Tool Authorization | System shall enforce tool authorization per agent role (e.g., DEV can run_code, CEO cannot) | UC-028 | Class: ToolRegistry (isToolAuthorizedForRole method) | apps/api/src/modules/tools/tool.registry.ts | TEST-TOOLS-001 | Implemented |
| FR-AGENT-011 | Agent Configuration | Admin shall configure agent LLM models (provider, model, fallback) | UC-003 | Class: AgentsService (updateConfig method) | apps/api/src/modules/agents/agents.service.ts | TEST-AGENT-CONFIG-001 | Implemented |
| FR-AGENT-012 | Agent Communication | Agents shall broadcast messages to Virtual Office meeting room | UC-021, UC-024 | Class: BaseAgent (emitMessage method), AppWebSocketGateway | apps/api/src/modules/agents/base.agent.ts, apps/api/src/modules/websocket/websocket.gateway.ts | TEST-AGENT-MSG-001 | Implemented |
| FR-AGENT-013 | Agent Registry & Role Profiles | Adding a role shall only require its RoleProfile, its strategies and one entry in AGENT_CLASSES; the orchestrator resolves agents from the AGENTS token | UC-004, UC-009-016 | Registry (AGENTS token), RoleProfile value object, IAgent | apps/api/src/modules/agents/agents.registry.ts, apps/api/src/modules/agents/profiles/, apps/api/src/modules/orchestrator/agent-orchestrator.service.ts | apps/api/tests/unit/agents/agent-registry.spec.ts, apps/api/tests/unit/agents/role-profile.spec.ts | Implemented |

### 3.4 Workflow Orchestration Subsystem

| Req ID | Requirement Name | Description | Use Case IDs | Design Artifacts | Implementation Files | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|---------------------|----------|--------|
| FR-WF-001 | DAG Workflow Execution | System shall execute workflows as DAGs with nodes (agent_task, human_approval, condition, parallel) | UC-004 | Class: WorkflowEngine | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-001, TEST-WF-002 | Implemented |
| FR-WF-002 | Cycle Detection | System shall detect and reject workflow definitions with cycles | UC-004 | Class: WorkflowValidator (detectCycles method) | apps/api/src/modules/workflow/workflow.validator.ts | TEST-WF-003 | Implemented |
| FR-WF-003 | State Persistence | System shall persist workflow state (currentNodeId, context) to database for recovery | UC-004, UC-015 | Class: WorkflowEngine (saveState method) | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-004 | Implemented |
| FR-WF-004 | Retry with Backoff | System shall retry failed agent tasks up to 3 times with exponential backoff (2^n seconds) | UC-004 | Class: WorkflowEngine (retryStep method) | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-005 | Implemented |
| FR-WF-005 | Loop Protection | System shall prevent infinite loops by limiting node visits to 3 per node | UC-004 | Class: WorkflowEngine (checkLoopLimit method) | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-006 | Implemented |
| FR-WF-006 | Parallel Execution | System shall execute parallel branches using BullMQ jobs and merge results | UC-004 | Class: WorkflowEngine (executeParallelNode method) | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-007 | Implemented |
| FR-WF-007 | Workflow Recovery | System shall recover running workflows on restart and resume from last checkpoint | UC-015 | Class: WorkflowEngine (recoverWorkflows method) | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-008 | Implemented |
| FR-WF-008 | Workflow Rollback | System shall rollback workflow to previous checkpoint with rollback handlers | UC-019 | Class: WorkflowEngine (rollback method), Memento pattern | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-009 | Planned |
| FR-WF-009 | Workflow Pause/Resume | Board Member shall pause and resume workflows manually | UC-004 | Class: WorkflowEngine (pauseWorkflow, resumeWorkflow methods) | apps/api/src/modules/workflow/workflow.engine.ts | TEST-WF-010 | Implemented |
| FR-WF-010 | Workflow Status Tracking | System shall track workflow status: running, paused, completed, failed, cancelled | UC-004, UC-007 | Enum: WorkflowStatus in schema.prisma | apps/api/prisma/schema.prisma | TEST-WF-011 | Implemented |

### 3.5 Approval System Subsystem

| Req ID | Requirement Name | Description | Use Case IDs | Design Artifacts | Implementation Files | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|---------------------|----------|--------|
| FR-APPR-001 | Create Approval Request | System shall create approval requests when workflow reaches human_approval node | UC-005 | Class: ApprovalService (createApprovalRequest method) | apps/api/src/modules/approvals/approval.service.ts | TEST-APPR-001 | Implemented |
| FR-APPR-002 | Approval State Machine | System shall enforce approval status transitions: pending→(approved|rejected) only | UC-005, UC-006 | Class: ApprovalService (handleApprovalResponse method) | apps/api/src/modules/approvals/approval.service.ts | TEST-APPR-002, TEST-APPR-003 | Implemented |
| FR-APPR-003 | Approval Notification | System shall notify Board Member via WebSocket when approval is required | UC-005 | Event: HUMAN_APPROVAL_REQUIRED, AppWebSocketGateway | apps/api/src/modules/websocket/websocket.gateway.ts | TEST-APPR-004 | Implemented |
| FR-APPR-004 | Approval Response | Board Member shall approve or reject with optional comment | UC-005, UC-006 | Class: ApprovalService (handleApprovalResponse method) | apps/api/src/modules/approvals/approval.service.ts | TEST-APPR-005 | Implemented |
| FR-APPR-005 | Conditional Edges | System shall follow "onApprove" or "onReject" edges based on approval decision | UC-005, UC-006 | Class: WorkflowEngine (transitionToNextNode method) | apps/api/src/modules/workflow/workflow.engine.ts | TEST-APPR-006 | Implemented |

### 3.6 Cost Tracking Subsystem

| Req ID | Requirement Name | Description | Use Case IDs | Design Artifacts | Implementation Files | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|---------------------|----------|--------|
| FR-COST-001 | API Usage Logging | System shall log every LLM call with token counts, model, provider, response time | UC-009, UC-018 | Class: ApiUsageService (logUsage method) | apps/api/src/modules/llm/api-usage.service.ts | TEST-COST-001 | Implemented |
| FR-COST-002 | Cost Calculation | System shall calculate cost from token counts and model pricing | UC-009 | Class: ApiUsageService (calculateCost method) | apps/api/src/modules/llm/api-usage.service.ts | TEST-COST-002 | Implemented |
| FR-COST-003 | Budget Monitoring | System shall track project.costAccrued and compare to budget | UC-008, UC-011 | Class: CostModule (monitorBudget method) | apps/api/src/modules/cost/cost.service.ts | TEST-COST-003 | Implemented |
| FR-COST-004 | Budget Exceeded Alert | System shall pause workflows and notify Board Member when costAccrued ≥ budget | UC-011 | Class: CostModule (handleBudgetExceeded method) | apps/api/src/modules/cost/cost.service.ts | TEST-COST-004 | Implemented |
| FR-COST-005 | Cost Analytics Dashboard | Board Member shall view cost breakdown by agent, model, date | UC-008 | Class: CostController (getCostAnalytics method) | apps/api/src/modules/cost/cost.controller.ts | TEST-COST-005 | Implemented |
| FR-COST-006 | Token Usage Aggregation | System shall aggregate token usage by agentRole, model, date | UC-008 | Class: CostService (aggregateUsage method) | apps/api/src/modules/cost/cost.service.ts | TEST-COST-006 | Implemented |

### 3.7 Memory & Learning Subsystem

| Req ID | Requirement Name | Description | Use Case IDs | Design Artifacts | Implementation Files | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|---------------------|----------|--------|
| FR-MEM-001 | Vector Embeddings | System shall generate vector embeddings for memories using LLM embed API | UC-017 | Class: MemoryService (generateEmbedding method) | apps/api/src/modules/memory/memory.service.ts | TEST-MEM-005 | Implemented |
| FR-MEM-002 | Semantic Search | System shall search memories using pgvector cosine distance with top-k results | UC-017, UC-009-016 | Class: MemoryService (searchMemories method with SQL) | apps/api/src/modules/memory/memory.service.ts | TEST-MEM-006, TEST-MEM-007 | Implemented |
| FR-MEM-003 | Memory Importance | System shall validate memory importance ∈ [1, 10] (Requirement 17.3) | UC-017 | MemoryService validation | apps/api/src/modules/memory/memory.service.ts | TEST-MEM-008 | Implemented |
| FR-MEM-004 | Memory Namespace | System shall organize memories by namespace (e.g., "requirements_patterns", "coding_conventions") | UC-017 | Schema: AgentMemory.namespace field | apps/api/prisma/schema.prisma | TEST-MEM-009 | Implemented |
| FR-MEM-005 | Memory Pruning | System shall prune old low-importance memories when agent exceeds 1000 memories | UC-017 | Class: MemoryService (pruneMemories method) | apps/api/src/modules/memory/memory.service.ts | TEST-MEM-010 | Planned |

---

## 4. Non-Functional Requirements Traceability

### 4.1 Performance Requirements

| Req ID | Requirement Name | Description | Use Case IDs | Design Decisions | Implementation | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|----------------|----------|--------|
| NFR-PERF-001 | API Response Time | Project creation, approval response, config update must complete <2 seconds | UC-002, UC-003, UC-005 | Async workflow dispatch (BullMQ), database indexing | Database indexes on projectId, status fields | TEST-PERF-001, TEST-PERF-002 | Implemented |
| NFR-PERF-002 | Semantic Search Performance | Memory search must return results <500ms for databases with <100k memories | UC-017 | pgvector HNSW index on embeddings | SQL HNSW index creation migration | TEST-PERF-003 | Implemented |
| NFR-PERF-003 | Workflow Visualization Load Time | Workflow visualization must update within 1 second of state change | UC-007 | WebSocket push notifications instead of polling | Socket.IO real-time events | TEST-PERF-004 | Implemented |
| NFR-PERF-004 | Cost Dashboard Load Time | Cost dashboard must load <3 seconds for projects with <10k API calls | UC-008 | Aggregation pipelines, caching layer | Prisma aggregation queries, Redis cache | TEST-PERF-005 | Planned |
| NFR-PERF-005 | Concurrent Workflows | System must support 100 concurrent workflows | UC-004 | Redis/BullMQ horizontal scaling, connection pooling | BullMQ queue configuration, Prisma pool size | TEST-PERF-006 | Planned |

### 4.2 Security Requirements

| Req ID | Requirement Name | Description | Use Case IDs | Design Decisions | Implementation | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|----------------|----------|--------|
| NFR-SEC-001 | Password Security | Passwords must be hashed with bcrypt salt rounds ≥12 | UC-001 | bcrypt library with rounds=12 | AuthService register method | TEST-SEC-001 | Implemented |
| NFR-SEC-002 | Prompt Injection Prevention | All user inputs must be sanitized against prompt injection patterns | UC-002, UC-009-016 | Input sanitizer with 15+ injection patterns | security/input-sanitizer.ts (sanitizeUserInput) | TEST-SEC-002, TEST-SEC-003 | Implemented |
| NFR-SEC-003 | Sandbox Isolation | Code execution must be isolated in Docker containers with resource limits | UC-012, UC-028 | Docker node:18-alpine with CPU/memory limits | SandboxExecutor with Docker API | TEST-SEC-004, TEST-SEC-005 | Implemented |
| NFR-SEC-004 | Tool Authorization | Agents must only execute authorized tools per role | UC-028 | ToolRegistry with role-based ACL | ToolRegistry.isToolAuthorizedForRole() | TEST-SEC-006 | Implemented |
| NFR-SEC-005 | JWT Token Security | JWT tokens must expire after 24 hours, use HS256 algorithm | UC-001 | NestJS @nestjs/jwt with expiresIn: '24h' | AuthModule JwtModule.register() | TEST-SEC-007 | Implemented |
| NFR-SEC-006 | Environment Variable Validation | System must validate all required environment variables on startup | All | EnvValidator class with Joi schema | security/env-validator.ts | TEST-SEC-008 | Implemented |

### 4.3 Reliability Requirements

| Req ID | Requirement Name | Description | Use Case IDs | Design Decisions | Implementation | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|----------------|----------|--------|
| NFR-REL-001 | Circuit Breaker for LLM | LLM gateway must use circuit breaker (open after 3 failures, half-open after 60s) | UC-018 | Circuit Breaker pattern with failure counter | LLMProviderFactory, LLMGatewayStatus table | TEST-REL-001, TEST-REL-002 | Implemented |
| NFR-REL-002 | Workflow Retry | Failed agent tasks must retry up to 3 times with exponential backoff | UC-004 | Retry logic in WorkflowEngine | WorkflowEngine.retryStep() | TEST-REL-003 | Implemented |
| NFR-REL-003 | Workflow Recovery | System must recover running workflows on restart | UC-015 | State persistence in PostgreSQL, recovery on bootstrap | WorkflowEngine.onModuleInit() | TEST-REL-004 | Implemented |
| NFR-REL-004 | Database Connection Resilience | System must gracefully handle database connection loss | All | PrismaService with connection retry, health checks | PrismaService.onModuleInit() | TEST-REL-005 | Implemented |
| NFR-REL-005 | Idempotent Workflow Steps | Workflow steps must be idempotent (safe to retry) | UC-004 | Idempotency keys for state-changing operations | WorkflowStep.id as idempotency key | TEST-REL-006 | Planned |

### 4.4 Maintainability Requirements (SOLID Principles & Design Patterns)

| Req ID | Requirement Name | Description | Use Case IDs | Design Decisions | Implementation | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|----------------|----------|--------|
| NFR-MAINT-001 | Single Responsibility Principle | Each class shall have one reason to change | All | Separate services: AuthService, ProjectApplicationService, WorkflowEngine, MemoryService | All service classes | CODE-REVIEW-001 | Implemented |
| NFR-MAINT-002 | Open/Closed Principle | Classes shall be open for extension, closed for modification | UC-009-016 | AGENTS multi-provider token; orchestrator depends on IAgent[]; one RoleProfile per role | agents/agents.registry.ts, orchestrator/agent-orchestrator.service.ts, agents/profiles/*.ts | apps/api/tests/unit/agents/agent-registry.spec.ts (9th TestAgent added without orchestrator change) | Implemented |
| NFR-MAINT-003 | Liskov Substitution Principle | Derived classes must be substitutable for base class | UC-004 | All agents implement IAgent interface, WorkflowEngine uses IAgent | IAgent interface, BaseAgent implements | CODE-REVIEW-003 | Implemented |
| NFR-MAINT-004 | Interface Segregation Principle | Clients shall not depend on interfaces they don't use | All | Separate interfaces: IAgent, IThinkingStrategy, IActionStrategy, IAgentObserver | domain/ interfaces | CODE-REVIEW-004 | Implemented |
| NFR-MAINT-005 | Dependency Inversion Principle | Depend on abstractions, not concretions | All | NestJS dependency injection, services depend on interface tokens | Constructor injection throughout | CODE-REVIEW-005 | Implemented |
| NFR-MAINT-006 | Strategy Pattern | Agent thinking/acting strategies shall be interchangeable | UC-009-016 | IThinkingStrategy, IActionStrategy interfaces | modules/agents/strategies/ (8 thinking + 8 action strategies) | apps/api/tests/unit/agents/agent-strategies.spec.ts | Implemented |
| NFR-MAINT-007 | State Pattern | Agent and workflow states shall be managed via state machines | UC-004, UC-005 | AgentStateMachine, WorkflowStateMachine classes | domain/agent/AgentStateMachine.ts | CODE-REVIEW-007 | Implemented |
| NFR-MAINT-008 | Observer Pattern | Agents shall emit events to observers (WebSocket gateway) | UC-021, UC-024 | IAgentObserver interface, AppWebSocketGateway implements | websocket/websocket.gateway.ts | CODE-REVIEW-008 | Implemented |
| NFR-MAINT-009 | Template Method Pattern | Agent execution flow (think→act) shall be defined in base class | UC-009-016 | BaseAgent.execute(): resolve task type → think → act → complete/error | BaseAgent.execute() | apps/api/tests/unit/agents/base-agent.spec.ts | Implemented |
| NFR-MAINT-010 | Factory Pattern | LLM providers shall be created via factory | UC-018 | LLMProviderFactory.getProvider(config) | llm/llm-provider.factory.ts | CODE-REVIEW-010 | Implemented |

### 4.5 Testability Requirements

| Req ID | Requirement Name | Description | Use Case IDs | Design Decisions | Implementation | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|----------------|----------|--------|
| NFR-TEST-001 | Unit Test Coverage | Code coverage must be ≥90% for branches, functions, lines, statements | All | Jest test framework, coverage thresholds in jest.config.js | jest.config.js (coverageThreshold) | All TEST-* | Implemented |
| NFR-TEST-002 | Integration Tests | All API endpoints must have integration tests | All | Jest + Supertest for HTTP testing | **/*.e2e-spec.ts files | TEST-INT-001 to TEST-INT-050 | Partial |
| NFR-TEST-003 | Mocking External Dependencies | Tests must mock LLM providers, Redis, Docker sandbox | All | Jest mock functions, dependency injection | Test files with jest.mock() | All TEST-* | Implemented |
| NFR-TEST-004 | Test Isolation | Each test must be independent and not affect other tests | All | beforeEach/afterEach setup/teardown, in-memory database | Test suites with setup/teardown | All TEST-* | Implemented |

### 4.6 Usability Requirements

| Req ID | Requirement Name | Description | Use Case IDs | Design Decisions | Implementation | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|----------------|----------|--------|
| NFR-USABILITY-001 | Real-Time Feedback | Board Member must receive real-time updates on workflow progress, agent activities | UC-007, UC-021 | WebSocket push notifications | AppWebSocketGateway, Socket.IO | TEST-UI-001 | Implemented |
| NFR-USABILITY-002 | Intuitive Kanban Board | Task management must use drag-and-drop Kanban interface | UC-020 | React DnD library or react-beautiful-dnd | Frontend Kanban component | TEST-UI-002 | Planned |
| NFR-USABILITY-003 | Cost Visualization | Cost analytics must use charts (pie, bar, line) | UC-008 | Chart.js or Recharts library | Frontend cost dashboard | TEST-UI-003 | Planned |

### 4.7 Scalability Requirements

| Req ID | Requirement Name | Description | Use Case IDs | Design Decisions | Implementation | Test IDs | Status |
|--------|------------------|-------------|--------------|------------------|----------------|----------|--------|
| NFR-SCALE-001 | Horizontal Scaling | System must support horizontal scaling (multiple NestJS instances) | All | Stateless API design, Redis for shared state | Stateless services, Redis session store | TEST-SCALE-001 | Planned |
| NFR-SCALE-002 | Database Optimization | Database queries must use indexes and avoid N+1 problems | All | Prisma includes, database indexes on foreign keys | schema.prisma @@index directives | TEST-SCALE-002 | Implemented |

---

## 5. Design Pattern Traceability

| Pattern | Use Cases | Classes/Interfaces | Purpose | Status |
|---------|-----------|-------------------|---------|--------|
| **Strategy** | UC-009-016 | IThinkingStrategy, IActionStrategy, BaseAgent | Encapsulate agent reasoning/action algorithms, allow runtime swapping | Implemented |
| **State** | UC-004, UC-005 | AgentStateMachine, WorkflowStateMachine | Manage agent/workflow state transitions with validation | Implemented |
| **Observer** | UC-021, UC-024 | IAgentObserver, AppWebSocketGateway | Decouple agents from WebSocket gateway, broadcast events | Implemented |
| **Template Method** | UC-009-016 | BaseAgent.execute() | Define agent execution skeleton (think→act), subclasses implement details | Implemented |
| **Factory** | UC-018 | LLMProviderFactory | Create LLM provider instances based on configuration | Implemented |
| **Singleton** | UC-004 | WorkflowEngine (via NestJS DI) | Ensure single workflow orchestrator instance | Implemented |
| **Circuit Breaker** | UC-018 | LLMGatewayStatus, LLMProviderFactory | Prevent cascading failures from LLM provider outages | Implemented |
| **Memento** | UC-019 | WorkflowSnapshot | Capture and restore workflow state for rollback | Planned |
| **Command** | UC-004 | WorkflowCommand (planned) | Encapsulate workflow node execution as command objects | Planned |
| **Repository** | All | IProjectRepository, IAgentRepository (planned) | Abstract data access layer from domain logic | Planned |

---

## 6. Architecture Traceability

| Requirement Subsystem | Architectural Layer | Modules | Design Rationale |
|-----------------------|---------------------|---------|------------------|
| Authentication & Authorization | Infrastructure Layer | AuthModule, JwtStrategy | Separates security concerns from business logic |
| Project Management | Application Layer | ProjectsModule, ProjectApplicationService, TaskApplicationService, MilestoneApplicationService | Orchestrates project CRUD and business rules |
| Agent Framework | Domain Layer + Application Layer | AgentsModule, BaseAgent, domain/agent-state-machine.ts | Core business logic in domain, orchestration in application |
| Workflow Orchestration | Application Layer + Infrastructure Layer | WorkflowModule, BullMQ integration | Workflow engine coordinates agents, BullMQ handles async execution |
| Approval System | Application Layer | ApprovalsModule, ApprovalService | Human-in-the-loop coordination |
| Cost Tracking | Application Layer | CostModule, ApiUsageService | Cross-cutting concern for budget monitoring |
| Memory & Learning | Infrastructure Layer + Domain Layer | MemoryModule, AgentMemory entity | Vector search infrastructure, memory domain logic |

---

## 7. Test Coverage Matrix

| Subsystem | Unit Tests | Integration Tests | E2E Tests | Coverage % | Status |
|-----------|------------|-------------------|-----------|------------|--------|
| Authentication | 8 tests | 4 tests | 2 tests | 95% | Complete |
| Project Management | 15 tests | 8 tests | 5 tests | 92% | Complete |
| Agent Framework (existing) | 20 tests | 6 tests | 3 tests | 88% | Complete |
| Agent Framework (new: BA, Architect, QC) | 0 tests | 0 tests | 0 tests | 0% | Not Started |
| Workflow Orchestration | 25 tests | 10 tests | 4 tests | 91% | Complete |
| Approval System | 10 tests | 5 tests | 2 tests | 93% | Complete |
| Cost Tracking | 12 tests | 4 tests | 2 tests | 90% | Complete |
| Memory & Learning | 15 tests | 6 tests | 1 test | 89% | Complete |
| **TOTAL** | **105 tests** | **43 tests** | **19 tests** | **90%** | **In Progress** |

---

## 8. Change Impact Analysis

This section demonstrates how the RTM enables impact analysis for proposed changes.

### Example 1: Adding ML-based Task Estimation (UC-024)

**Impacted Requirements:**
- FR-PROJ-005 (Task Breakdown) - PM Agent must now use ML model
- FR-AGENT-005 (PM Agent) - Add ML training/prediction logic
- NFR-PERF-001 - Estimation must complete within 5 seconds (new constraint)

**Impacted Design:**
- PmAgent class - Add trainEstimationModel() and predictEffort() methods
- New class: TaskComplexityModel (encapsulates ML logic)

**Impacted Implementation:**
- apps/api/src/modules/agents/pm.agent.ts (modify act method)
- apps/api/src/modules/ml/task-complexity-model.ts (new file)
- Database migration: Add Task.actualEffort field for training data

**Impacted Tests:**
- TEST-AGENT-PM-003 (new): Test ML prediction accuracy
- TEST-AGENT-PM-004 (new): Test fallback to heuristic when data insufficient

### Example 2: Implementing Workflow Rollback (UC-019)

**Impacted Requirements:**
- FR-WF-008 (Workflow Rollback) - Enable rollback to checkpoint

**Impacted Design:**
- WorkflowSnapshot class (Memento pattern) - Capture/restore state
- WorkflowNode interface - Add rollbackHandler property

**Impacted Implementation:**
- apps/api/src/modules/workflow/workflow.engine.ts (add rollback method)
- apps/api/src/modules/workflow/workflow-snapshot.ts (new file)
- apps/api/src/domain/workflow-node.interface.ts (add rollbackHandler)

**Impacted Tests:**
- TEST-WF-009 (new): Test successful rollback to checkpoint
- TEST-WF-010 (new): Test rollback handler failure recovery

---

## 9. Requirements Status Summary

| Status | Count | Percentage |
|--------|-------|------------|
| Implemented | 75 | 88.2% |
| Partial | 1 | 1.2% |
| Planned | 9 | 10.6% |
| **TOTAL** | **85** | **100%** |

_Recounted 2026-10-26 (Phase 3, Task 11) from the tables above._

### Planned Requirements (Priority for Next Sprint)
1. FR-WF-008 (Workflow Rollback)
2. FR-MEM-005 (Memory Pruning)
3. NFR-PERF-004 (Cost Dashboard Caching)
4. NFR-PERF-005 (Concurrent Workflow Load Testing)
5. NFR-REL-005 (Idempotency Key Implementation)
6. NFR-SCALE-001 (Horizontal Scaling Validation)

---

## 10. References

- **IEEE 830-1998**: IEEE Recommended Practice for Software Requirements Specifications
- **ISO/IEC/IEEE 29148:2018**: Systems and software engineering - Life cycle processes - Requirements engineering
- **Prisma Schema**: apps/api/prisma/schema.prisma
- **Use Case Specifications**: docs/requirements/use-cases.md
- **Design Patterns**: Gang of Four (GoF) - Design Patterns: Elements of Reusable Object-Oriented Software
- **SOLID Principles**: Robert C. Martin - Clean Architecture

---

**End of Requirements Traceability Matrix**

*Version 1.0.0 | December 10, 2024 | AI-CORP Development Team*
