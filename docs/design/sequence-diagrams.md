# Sequence Diagrams Documentation

## Executive Summary

This document provides comprehensive academic-grade documentation for all sequence diagrams in the AI-CORP multi-agent platform thesis project. Each sequence diagram captures critical workflows and interaction patterns, demonstrating the application of Object-Oriented Analysis and Design (OOAD) principles, UML 2.5 notation, and enterprise design patterns.

**Document Purpose**: Support thesis submission with detailed behavioral modeling of system interactions.

**UML Version**: UML 2.5 (OMG Standard)

**Diagram Tool**: PlantUML (text-based UML generation)

**Total Diagrams**: 6 sequence diagrams covering core workflows

---

## SD-001: Project Creation Workflow

### Overview

**Diagram ID**: SD-001  
**Title**: Project Creation Workflow  
**File**: `docs/diagrams/sequences/SD-001-project-creation.puml`  
**Primary Use Case**: UC-001 (Create Project)  
**Business Context**: Board Member initiates a new project, triggering automated multi-agent workflow for strategic planning and task breakdown.

### Purpose and Context

This sequence diagram models the end-to-end process of project creation in the AI-CORP platform, from user authentication through agent-driven strategic planning. It demonstrates:

1. **RESTful API interaction** between frontend and backend
2. **Workflow engine orchestration** of multi-agent collaboration
3. **Asynchronous processing** using BullMQ job queue
4. **Real-time notifications** via WebSocket
5. **Persistent state management** with PostgreSQL

The diagram is critical for understanding how human user actions trigger autonomous agent behavior, a core thesis contribution.

### Participants

| Participant | Type | Role |
|-------------|------|------|
| Board Member | Human Actor | Initiates project creation, receives real-time updates |
| AuthService | System Component | Validates user credentials, issues JWT tokens |
| ProjectController | System Component | HTTP endpoint handler, input validation |
| ProjectService | System Component | Business logic layer, transaction orchestration |
| PrismaDB | External System | PostgreSQL database via Prisma ORM |
| WorkflowEngine | System Component | DAG-based workflow orchestrator |
| CEOAgent | AI Agent | Strategic planning, milestone creation |
| PMAgent | AI Agent | Task breakdown, sprint planning |
| WebSocket | System Component | Real-time bidirectional communication gateway |

### Main Flow Description

1. **Authentication Phase** (Lines 1-8):
   - Board Member submits credentials via POST /api/auth/login
   - AuthService queries database for user record
   - Password validation using bcrypt hash comparison
   - JWT token generation and return (expiry: 24 hours)

2. **Project Creation Request** (Lines 9-20):
   - Board Member sends POST /api/projects with project metadata
   - ProjectController sanitizes inputs (protection against injection attacks)
   - ProjectService validates business rules (BR-001: Budget > 0, BR-002: Name unique)
   - Database transaction creates Project record with status='active'

3. **Workflow Initialization** (Lines 21-35):
   - ProjectService invokes WorkflowEngine.startWorkflow()
   - Engine creates WorkflowRun record (status='running', currentNodeId='ceo_plan')
   - WebSocket broadcasts WorkflowStateChangedEvent to Board Member
   - Asynchronous BullMQ job queued for node processing
   - **Design Pattern**: State Machine pattern manages workflow lifecycle

4. **CEO Agent Execution** (Lines 36-60):
   - WorkflowEngine invokes CEOAgent.execute() with project context
   - CEO think phase: semantic memory search for similar projects
   - CEO queries vector database for relevant strategic patterns
   - CEO calls LLM (GPT-4) for milestone generation
   - **Design Pattern**: Strategy pattern (ThinkingStrategy, ActionStrategy)
   - CEO act phase: creates 2-4 Milestone records in database
   - CEO saves new memory ("Created milestones for project X")
   - WebSocket emits AgentThinkingEvent and AgentActionEvent

5. **PM Agent Execution** (Lines 61-85):
   - WorkflowEngine transitions to next node (pm_breakdown)
   - PMAgent.execute() receives context with CEO milestones
   - PM loads milestones from database
   - PM calls LLM (GPT-3.5-turbo) for task breakdown
   - PM creates 5-20 Task records per milestone
   - WebSocket notifications keep Board Member informed

6. **Workflow Completion** (Lines 86-95):
   - WorkflowEngine transitions to endNode
   - WorkflowRun status updated to 'completed'
   - WebSocket broadcasts completion event
   - HTTP response returns Project object with 201 Created

### Design Patterns Highlighted

| Pattern | Implementation | Location in Diagram |
|---------|----------------|---------------------|
| **Template Method** | ProjectController defines skeleton (validate → service → respond), ProjectService implements business logic | Controller → Service flow |
| **State Machine** | WorkflowEngine manages transitions (PENDING → RUNNING → COMPLETED) with validated state rules | WorkflowEngine internal behavior |
| **Strategy Pattern** | CEOAgent and PMAgent use pluggable ThinkingStrategy and ActionStrategy interfaces | Agent.think() and Agent.act() calls |
| **Observer Pattern** | WebSocket broadcasts events to multiple subscribers (frontend, logging, analytics) | WebSocket event emissions |
| **Factory Pattern** | LLMProviderFactory creates appropriate LLM provider based on configuration | Agent.callLLM() internal |
| **Repository Pattern** | PrismaService abstracts database access, hiding SQL/ORM details | All database interactions |

### Synchronous vs Asynchronous Interactions

**Synchronous Interactions** (blocking, request-response):
- User → AuthService (login requires immediate response)
- Controller → ProjectService (HTTP request handler waits for service)
- ProjectService → Database (transaction must complete before response)

**Asynchronous Interactions** (non-blocking, fire-and-forget):
- WorkflowEngine → WorkflowEngine.processCurrentNode() (BullMQ job queued)
- Agent → WebSocket notifications (best-effort delivery, no ACK required)
- Agent → Agent.saveMemory() (memory storage is non-blocking)

**Notation**:
- Solid arrows (→) represent synchronous calls
- Dashed arrows (-->) represent asynchronous messages or return values
- Half-arrows (->>) represent asynchronous fire-and-forget

### Timing Constraints

| Operation | Max Duration | Rationale |
|-----------|--------------|-----------|
| POST /api/projects | < 2 seconds | NFR-001: User experience requirement |
| WorkflowRun.create() | < 500ms | Database write SLA |
| CEOAgent.execute() | < 60 seconds | LLM timeout (10s think + 10s act + 40s buffer) |
| PMAgent.execute() | < 60 seconds | LLM timeout (10s think + 10s act + 40s buffer) |
| WebSocket notification delivery | < 500ms | Real-time UX requirement |
| Total workflow (CEO + PM) | < 3 minutes | End-to-end user waiting time |

### Key Invariants

1. **Project.id is unique**: Enforced by database primary key constraint
2. **Project.status ∈ {active, paused, completed, cancelled}**: Enum validation
3. **WorkflowRun.currentNodeId always references valid node**: Foreign key constraint
4. **CEOAgent creates 2-4 milestones**: Business rule BR-004
5. **PMAgent creates ≥5 tasks**: Business rule BR-005
6. **All state transitions are atomic**: Database transaction boundaries
7. **WebSocket events are ordered**: Socket.IO guarantees FIFO delivery per connection

### Preconditions

- User has valid account with 'board_member' or 'admin' role
- User has not exceeded project creation quota (max 10 active projects)
- Database is accessible and not in read-only mode
- Redis is available for BullMQ job queue
- LLM gateway (9Router) is reachable (circuit breaker handles failures)

### Postconditions

- Project record exists in database with status='active'
- WorkflowRun record exists with status='completed'
- 2-4 Milestone records exist linked to project
- 10-80 Task records exist linked to milestones
- 2 AgentMemory records created (CEO + PM lessons)
- Board Member has received WebSocket notifications
- HTTP response returned with 201 status code

---

## SD-002: Agent Think-Act Cycle

### Overview

**Diagram ID**: SD-002  
**Title**: Agent Think-Act Cycle  
**File**: `docs/diagrams/sequences/SD-002-agent-think-act-cycle.puml`  
**Primary Use Case**: UC-013 (Execute Agent Task Node)  
**Business Context**: Core agent execution model demonstrating state machine, strategy pattern, and observer pattern integration.

### Purpose and Context

This sequence diagram models the internal execution flow of an AI agent processing a workflow task. It is the most architecturally significant diagram in the system, as it demonstrates:

1. **State Machine pattern** for agent lifecycle management
2. **Strategy pattern** for pluggable thinking and action strategies
3. **Observer pattern** for event-driven notifications
4. **Template Method pattern** for agent execution skeleton
5. **Circuit Breaker pattern** for external LLM service resilience

This diagram directly supports the thesis claim that the system uses advanced OOP design patterns for enterprise-grade multi-agent orchestration.

### Participants

| Participant | Type | Role |
|-------------|------|------|
| WorkflowEngine | System Component | Invokes agent execution as part of workflow |
| BaseAgent | Abstract Class | Template method defining think → act skeleton |
| AgentStateMachine | System Component | Manages state transitions with validation |
| ThinkingStrategy | Interface (Strategy Pattern) | Pluggable reasoning algorithm per agent role |
| ActionStrategy | Interface (Strategy Pattern) | Pluggable action execution per agent role |
| LLMProvider | External System | Large Language Model API (OpenAI, Anthropic, etc.) |
| ToolExecutor | System Component | Executes tools in isolated Docker sandbox |
| AgentEventEmitter | System Component | Event bus for agent events |
| Observer | Interface (Observer Pattern) | Subscribers to agent events (WebSocket, Logger, Metrics) |

### Main Flow Description

1. **Execution Trigger** (Lines 1-10):
   - WorkflowEngine calls BaseAgent.execute(context)
   - **Template Method Pattern**: execute() defines skeleton (think → act → return)
   - Agent remains in IDLE state initially

2. **State Transition: IDLE → THINKING** (Lines 11-30):
   - Agent calls AgentStateMachine.transitionTo(THINKING)
   - State machine validates transition rules (IDLE → THINKING is valid)
   - State machine updates currentState and appends to history array
   - AgentEventEmitter emits StateChangedEvent
   - All registered Observers receive event (WebSocket, Logger, Metrics)
   - **Design Pattern**: Observer pattern decouples state changes from reactions

3. **Think Phase with Strategy Pattern** (Lines 31-55):
   - Agent delegates to ThinkingStrategy.think(context)
   - **Strategy Pattern**: Each agent role has custom strategy (CEOThinkingStrategy, PMThinkingStrategy)
   - Strategy loads semantic memories from vector database (top-5 by similarity)
   - Strategy calls LLMProvider.chat() with reasoning prompt
   - **External Boundary**: LLM Gateway with circuit breaker
   - Circuit breaker states: CLOSED (normal), OPEN (fallback), HALF_OPEN (testing)
   - Strategy parses LLM response into structured ThinkingResult
   - AgentEventEmitter emits ThinkingEvent for frontend display

4. **State Transition: THINKING → ACTING** (Lines 56-70):
   - Agent calls AgentStateMachine.transitionTo(ACTING)
   - State machine validates transition (THINKING → ACTING is valid)
   - StateChangedEvent emitted to observers

5. **Act Phase with Strategy Pattern** (Lines 71-110):
   - Agent delegates to ActionStrategy.act(thought, context)
   - Strategy determines required tools based on agent role and thought
   - Agent.executeTool() performs role-based access control (RBAC)
   - Tool parameters validated against JSON schema
   - ToolExecutor spawns Docker container (node:18-alpine)
   - Resource limits enforced: 256MB RAM, 50% CPU, 30s timeout
   - Tool output sanitized to prevent injection attacks
   - Strategy calls LLM again to summarize outcome
   - ActionResult returned with status='success'
   - AgentEventEmitter emits ActionEvent

6. **State Transition: ACTING → COMPLETED** (Lines 111-125):
   - Agent calls AgentStateMachine.transitionTo(COMPLETED)
   - StateChangedEvent triggers observers
   - Observers perform side effects (log, save metrics, notify frontend)

7. **Memory Storage** (Lines 126-135):
   - Agent calls saveMemory() to store lesson learned
   - Memory includes: namespace, content, importance score (1-10)
   - Vector embedding generated for future semantic search
   - **Learning Cycle**: Agent improves over time via memory retrieval

8. **Return Result** (Lines 136-140):
   - Agent returns AgentResult to WorkflowEngine
   - Result includes thought, action, and final state

### Design Patterns Highlighted

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **Template Method** | BaseAgent.execute() defines skeleton (think → act), subclasses implement specifics | Code reuse, enforces execution order |
| **State Pattern** | AgentStateMachine validates transitions, prevents invalid state changes | State integrity, error prevention |
| **Strategy Pattern** | IThinkingStrategy and IActionStrategy allow pluggable algorithms per agent role | Open/Closed Principle (OCP), role-specific behavior |
| **Observer Pattern** | AgentEventEmitter notifies multiple subscribers on events | Decoupling, Single Responsibility Principle (SRP) |
| **Circuit Breaker** | LLMProvider handles external service failures with fallback | Fault tolerance, resilience |
| **Factory Pattern** | ToolRegistry.getTool() creates tool executors | Dependency Inversion Principle (DIP) |

### Synchronous vs Asynchronous Interactions

**Synchronous**:
- Agent → AgentStateMachine (state transitions are atomic)
- Agent → ThinkingStrategy (blocks until thought generated)
- Agent → ActionStrategy (blocks until action completed)
- Agent → LLMProvider (blocks with timeout)
- Agent → ToolExecutor (blocks with timeout)

**Asynchronous**:
- AgentEventEmitter → Observers (fire-and-forget notifications)
- Agent → saveMemory() (memory storage is background task)

### Timing Constraints

| Operation | Max Duration | Enforcement |
|-----------|--------------|-------------|
| State transition | < 100ms | In-memory operation |
| Think phase | < 10 seconds | LLM timeout |
| Act phase | < 30 seconds | Sandbox timeout |
| LLM API call | < 10 seconds | HTTP client timeout |
| Tool execution | < 30 seconds | Docker container timeout |
| Total execute() | < 60 seconds | Workflow engine timeout |

### Key Invariants

1. **State transitions are validated**: Cannot go IDLE → ACTING (must pass through THINKING)
2. **History is append-only**: StateTransition[] never modified, only appended
3. **Observers never block**: Event emission is non-blocking, failures are logged
4. **Tool RBAC enforced**: DEV can use 'code_execution', QA cannot
5. **Memory importance ∈ [1, 10]**: Enforced by validation and database CHECK constraint
6. **LLM fallback always succeeds**: Circuit breaker guarantees response (may use lower-quality model)

### Postconditions

- Agent state is COMPLETED or ERROR
- AgentResult returned with thought and action
- State transition history contains 3 entries (IDLE→THINKING, THINKING→ACTING, ACTING→COMPLETED)
- Memory saved to vector database with embedding
- All observers notified of state changes
- Tool output sanitized and safe

---

## SD-003: Human Approval Flow

### Overview

**Diagram ID**: SD-003  
**Title**: Human Approval Flow  
**File**: `docs/diagrams/sequences/SD-003-human-approval-flow.puml`  
**Primary Use Case**: UC-003 (Approve Workflow Step)  
**Business Context**: Human-in-the-loop decision making for critical workflow steps (e.g., budget approval, deployment authorization).

### Purpose and Context

This sequence diagram models the workflow pause/resume mechanism triggered by human approval nodes. It demonstrates:

1. **State Pattern** for approval lifecycle (pending → approved/rejected)
2. **State Machine pattern** for workflow pause/resume
3. **Real-time WebSocket notifications** for instant user feedback
4. **Transactional state persistence** for crash recovery
5. **Conditional edge routing** based on user decision

This is critical for enterprise workflows where human oversight is required for high-risk operations.

### Participants

| Participant | Type | Role |
|-------------|------|------|
| WorkflowEngine | System Component | Orchestrates workflow, pauses at approval nodes |
| ApprovalService | System Component | Manages approval lifecycle, validates state transitions |
| WebSocketGateway | System Component | Real-time bidirectional communication |
| BoardMember | Human Actor | Reviews and approves/rejects workflow steps |
| ApprovalController | System Component | HTTP endpoint for approval responses |
| PrismaDB | External System | Persistent storage for workflow and approval state |

### Main Flow Description

1. **Workflow Reaches Approval Node** (Lines 1-15):
   - WorkflowEngine processes currentNode
   - Node type is 'human_approval' (requires user decision)
   - Engine calls ApprovalService.createApprovalRequest()

2. **Create Approval Record** (Lines 16-25):
   - ApprovalService creates Approval record with status='pending'
   - **State Pattern**: Approval has 3 states (pending, approved, rejected)
   - State transition rules enforced: only pending → approved/rejected is valid
   - Database stores approval with workflowRunId, userId, approvalType, requestData

3. **Real-Time Notification** (Lines 26-40):
   - ApprovalService emits HumanApprovalRequiredEvent via WebSocket
   - WebSocket pushes notification to Board Member's browser
   - Frontend displays approval modal with requestData
   - User acknowledges notification (WebSocket ACK)

4. **Workflow Pauses** (Lines 41-55):
   - WorkflowEngine calls pauseWorkflow(runId)
   - **State Machine**: Workflow transitions running → paused
   - Engine saves workflow state (currentNodeId, context variables) for recovery
   - Database updated with status='paused'
   - WebSocket broadcasts WorkflowStateChangedEvent
   - **Key Characteristic**: No timeout, workflow pauses indefinitely until human responds

5. **User Reviews Approval** (Lines 56-70):
   - Board Member reviews approval context (project summary, cost, risk)
   - Board Member makes decision (Approve or Reject)
   - User submits POST /api/approvals/:id/respond with status and optional comment

6. **Handle Approval Response** (Lines 71-90):
   - ApprovalController validates input (status ∈ ['approved', 'rejected'])
   - ApprovalService.handleApprovalResponse() validates state transition
   - **Business Rule BR-017.7**: Approval can only transition from 'pending' to 'approved'/'rejected'
   - If current status is NOT 'pending', return 400 Bad Request
   - If valid, database updates approval record with status, comment, respondedAt

7. **Resume Workflow** (Lines 91-110):
   - ApprovalService calls WorkflowEngine.resumeWorkflow(runId, skipProcessNode=true)
   - skipProcessNode=true prevents re-processing the approval node
   - Workflow status transitions paused → running
   - WebSocket broadcasts state change

8. **Conditional Edge Transition** (Lines 111-130):
   - ApprovalService calls WorkflowEngine.transitionToNextNode(runId, edgeCondition='onApprove')
   - Engine finds outgoing edges with condition='onApprove' (if approved) or 'onReject' (if rejected)
   - Workflow moves to success path or fallback path based on decision
   - Context variables updated with approval result
   - WebSocket notifies of node transition

9. **Continue Workflow Execution** (Lines 131-145):
   - WorkflowEngine.processCurrentNode() continues with next node
   - Asynchronous BullMQ job queued
   - HTTP response returns approval object with workflowResumed=true

### Design Patterns Highlighted

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **State Pattern** | Approval has 3 states with strict transition rules (pending → approved/rejected only) | Prevents invalid state changes (e.g., approved → rejected) |
| **State Machine** | Workflow lifecycle (running → paused → running) with validated transitions | Enables pause/resume with recovery |
| **Observer Pattern** | WebSocket broadcasts state changes to all interested clients | Real-time updates, decoupled notifications |
| **Command Pattern** | ApprovalCommand encapsulates user decision (approve/reject) | Undo/audit trail support |
| **Memento Pattern** | saveWorkflowState() captures complete state for crash recovery | Fault tolerance |

### Synchronous vs Asynchronous Interactions

**Synchronous**:
- WorkflowEngine → ApprovalService.createApprovalRequest()
- User → ApprovalController (HTTP request-response)
- ApprovalService → Database (transactional updates)
- ApprovalService → WorkflowEngine.resumeWorkflow()

**Asynchronous**:
- ApprovalService → WebSocket (fire-and-forget notifications)
- WorkflowEngine → WorkflowEngine.processCurrentNode() (BullMQ job)

### Timing Constraints

| Operation | Max Duration | Notes |
|-----------|--------------|-------|
| Create approval record | < 500ms | Database write |
| WebSocket notification delivery | < 500ms | Real-time UX |
| State persistence | < 200ms | Atomic transaction |
| Resume workflow | < 1 second | Includes state restore |
| **User decision time** | **Unlimited** | No timeout enforced |

### Key Invariants

1. **Only one pending approval per workflow run**: Enforced by unique index on (workflowRunId, status='pending')
2. **Approval status can only transition once**: Update query includes WHERE status='pending'
3. **Workflow cannot proceed until approval resolved**: pauseWorkflow() blocks processCurrentNode()
4. **All state changes are atomic**: Database transactions ensure consistency
5. **Edge condition matches decision**: 'onApprove' edges only traversed if status='approved'

### Alternative Flow: Rejection

If user rejects:
1. edgeCondition = 'onReject'
2. Workflow transitions to abort/rollback node
3. Compensating transactions execute (see SD-006)
4. Workflow status → 'cancelled'
5. Project status → 'cancelled'
6. WebSocket notifies user of cancellation

### Postconditions

**If Approved**:
- Approval.status = 'approved', respondedAt is set
- WorkflowRun.status = 'running'
- WorkflowRun.currentNodeId updated to next node on success path
- WorkflowRun.context includes { approval_result: 'approved' }

**If Rejected**:
- Approval.status = 'rejected', respondedAt is set
- WorkflowRun transitions to abort/rollback path
- Compensating transactions may execute
- WorkflowRun.status = 'cancelled'

---

## SD-004: Task Delegation Chain

### Overview

**Diagram ID**: SD-004  
**Title**: Task Delegation Chain (default OOAD workflow v2.0.0)  
**File**: `docs/diagrams/sequences/SD-004-task-delegation-chain.puml`  
**Primary Use Case**: UC-025 (Agent Delegation Chain)  
**Business Context**: One project run through the default workflow, from goal to close-out, with every agent handing its output to the next.

> Updated 2026-10-26 (Phase 3, Task 11): the deployment role was removed from the roster, QC was added, and the order now follows OOAD (analysis and design before planning and implementation). See *Agent role review* in `Implementation_plan.md`.

### Purpose and Context

This sequence diagram models how the eight agents collaborate in one workflow run:

1. **Hand-off through the workflow engine**: agents never call each other; each `agent_task` node calls `AgentOrchestratorService.invokeAgent(role, context)` and the strategy's typed output (`BaOutput`, `QcOutput`, ...) is merged into the run's variables for the next node
2. **OOAD order**: CEO → BA → Architect → OOAD gate → PM → DEV → QC → QA → Marketing → human approval → CEO
3. **Two backward edges**: OOAD gate fail → Architect, QA reject → DEV
4. **Persistent artifacts**: everything the agents generate is written to the project workspace (`PROJECTS_WORKSPACE_DIR/projects/<id>/`) and summarised in `Project.ooadMetadata`

### Participants

| Participant | Type | Role | Responsibilities |
|-------------|------|------|------------------|
| Board Member | Human Actor | Project initiator | Starts the workflow, approves completion |
| WorkflowEngine | System Component | Orchestrator | Walks the DAG, merges agent outputs into variables |
| AgentOrchestratorService | System Component | Registry | Looks up the agent for a role in `IAgent[]` from the `AGENTS` token |
| CEO | AI Agent | Strategy | Milestone plan (`planMilestones`), close-out report (`complete_project`) |
| BA | AI Agent | Analysis | Actors and use cases, `use-cases.md`, use case diagram |
| Architect | AI Agent | Design | Domain model, class/sequence diagrams, patterns, layered code skeleton |
| OOAD gate | Workflow node | Process quality (QA) | Use case / entity / pattern counts and required artifacts |
| PM | AI Agent | Planning | One task per approved use case, ordered by priority |
| DEV | AI Agent | Implementation | Fills in the skeleton, marks services with `// UC-xxx` |
| QC | AI Agent | Product quality | Acceptance tests per use case, traceability matrix, coverage (`qc_passed`) |
| QA | AI Agent | Process quality | Design-conformance review using the QC report (`qa_approved`) |
| Marketing | AI Agent | Communication | Release announcement |
| ProjectWorkspace / PrismaDB | Persistence | Storage | Generated files / metadata, tasks, milestones, runs |

### Main Flow Description

1. **CEO – planMilestones**: CEO reads the goal and lists 2–4 milestones; the engine creates Milestone rows from the list.
2. **BA – generateUseCases**: BA returns JSON validated by `UseCaseDataSchema` (≥ 5 use cases), renders `docs/use-cases.md` and `docs/use-case-diagram.puml`, stores `ooadMetadata.useCases`.
3. **Architect – designArchitecture**: Architect reads the use cases, generates the domain model, patterns, layers and sequence diagrams for the high-priority use cases, renders the diagrams and the layered skeleton (`src/domain`, `src/application`, `src/infrastructure`, `src/presentation`).
4. **OOAD gate**: `QualityGateStrategy` checks the counts and that the required docs exist in the workspace. Fail → back to the Architect; pass → PM.
5. **PM – breakdownTasks**: one developer task per use case (title starts with the use case id); the engine creates Task rows in `todo`.
6. **DEV – implement**: DEV receives the OOAD design context, writes code into the workspace (unsafe paths are rejected); the engine moves tasks to `review`.
7. **QC – verify**: QC writes `tests/UC-xxx.spec.ts` for untested use cases, runs the project's Jest suite through `SandboxExecutor.runInWorkspace` (read-only mount of `projects/<id>`, no network), maps results per use case, builds `docs/traceability-matrix.md` (Passing / Failing / Missing) and stores coverage and pass/fail counts. `qc_passed` needs coverage ≥ 80% and no failing High-priority use case; otherwise it emits a `quality_warning`.
8. **QA – review**: QA reviews the code against the approved design, the QC report and the failing tests. `qa_approved = false` → tasks back to `in_progress` and the run returns to DEV; `true` → tasks `done`.
9. **Marketing – draftAnnouncement**, then **human approval** (`project_completion`).
10. **CEO – complete_project**: close-out report; the run is `completed`.

### Design Patterns Highlighted

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **Registry** | `AGENTS` token → `AgentOrchestratorService` map by role | Add a role without touching the orchestrator (OCP) |
| **Strategy** | One thinking + one action strategy per role | Role behaviour isolated from the agent contract |
| **Template Method** | `BaseAgent.execute()` (resolve task type → think → act → complete) | Same lifecycle and events for every role |
| **State** | `AgentStateMachine` (IDLE → THINKING → ACTING → COMPLETED → IDLE, ERROR) | Valid agent transitions only |
| **Chain of Responsibility** | Review chain QC → QA, with backward edges in the DAG | Product check before process check; more reviewers can be added (Task 15) |
| **Observer / Domain events** | `AgentEventEmitter`, `EventBus` (`TaskCompletedEvent`, `AgentErrorEvent`, ...) | Real-time UI and audit |

### Synchronous vs Asynchronous Interactions

**Synchronous**:
- `invokeAgent()` / `agent.execute()` complete before the engine moves to the next node
- LLM calls block with the node timeout

**Asynchronous**:
- Workflow steps run through BullMQ when Redis is available (direct execution otherwise)
- Domain events and WebSocket notifications are fire-and-forget

### Key Invariants

1. **Analysis and design come first**: PM and DEV never run before the OOAD gate has passed
2. **Every agent output is typed**: the engine reads named fields (`code`, `qcReport`, `qa_approved`) instead of free text
3. **Backward edges only**: gate → Architect, QA → DEV; no other cycles
4. **Artifacts persist**: files live in the project workspace, not in the sandbox
5. **One agent per role**: the orchestrator rejects duplicate registrations

### Postconditions

- `docs/` holds use cases, use case / domain / class / sequence diagrams, architecture patterns and the traceability matrix
- `src/` holds the layered implementation, `tests/` the acceptance tests per use case
- `Project.ooadMetadata` holds use cases, domain model, patterns, architecture and test coverage
- All tasks are `done`; the workflow run is `completed`

---

## SD-005: Agent Learning Cycle

### Overview

**Diagram ID**: SD-005  
**Title**: Agent Learning Cycle  
**File**: `docs/diagrams/sequences/SD-005-agent-learning-cycle.puml`  
**Primary Use Case**: UC-026 (Store Agent Memory), UC-027 (Search Semantic Memory)  
**Business Context**: Continuous learning system enabling agents to improve over time through experience accumulation and semantic retrieval.

### Purpose and Context

This sequence diagram models the agent memory system using vector embeddings for semantic search. It demonstrates:

1. **Vector database integration** (pgvector extension in PostgreSQL)
2. **Embedding generation** using LLM APIs (text-embedding-ada-002)
3. **Semantic similarity search** with cosine distance
4. **Memory-enhanced agent reasoning** for improved decision quality
5. **Namespace isolation** preventing cross-role memory leakage (Requirement 8)

This is a key innovation in the thesis, showing how agents learn from past experiences without explicit human retraining.

### Participants

| Participant | Type | Role |
|-------------|------|------|
| BaseAgent | Abstract Class | Coordinates memory save/load operations |
| TaskResult | Value Object | Encapsulates task outcome with evaluation metrics |
| MemoryService | System Component | Orchestrates memory lifecycle, enforces isolation |
| EmbeddingService | System Component | Generates 1536-dimensional embeddings via LLM API |
| VectorStore (pgvector) | External System | PostgreSQL with pgvector extension for vector storage |
| SemanticSearchService | System Component | Executes similarity queries with ranking |

### Main Flow Description

#### Part 1: Memory Storage (Learning Phase)

1. **Agent Completes Task** (Lines 1-20):
   - Agent finishes execute() with thought and action
   - Agent evaluates result (success/failure, execution time, resource usage)
   - TaskResult calculates importance score (1-10) based on:
     - 10: Critical insight, major breakthrough
     - 8: Significant learning, reusable pattern
     - 5: Routine completion, standard approach
     - 3: Minor observation
     - 1: Trivial fact

2. **Extract Lesson Learned** (Lines 21-35):
   - Agent synthesizes key learnings from task
   - Lesson format: "When implementing [context], I used [approach], which resulted in [outcome]. Key insight: [learning]."
   - Example: "When implementing authentication, I used JWT with refresh token rotation, which improved security. Key insight: Refresh tokens should have 7-day expiry."

3. **Generate Embedding** (Lines 36-55):
   - Agent calls MemoryService.saveMemory()
   - MemoryService validates inputs (agentRole, namespace, content, importance ∈ [1,10])
   - MemoryService calls EmbeddingService.generateEmbedding(content)
   - EmbeddingService sends POST /embeddings to LLM API (text-embedding-ada-002)
   - API returns 1536-dimensional vector representing semantic meaning
   - Embedding time: < 500ms

4. **Store in Vector Database** (Lines 56-85):
   - MemoryService creates AgentMemory record in PostgreSQL
   - Schema includes:
     - id: UUID primary key
     - agent_id: UUID foreign key to Agent table
     - agent_role: VARCHAR (CEO, PM, DEV, QA, ...) for filtering
     - namespace: VARCHAR (coding_patterns, strategy, deployment, ...)
     - content: TEXT (the lesson)
     - embedding: VECTOR(1536) (pgvector type)
     - importance: INTEGER CHECK (importance BETWEEN 1 AND 10)
     - metadata: JSONB (projectId, tags, timestamp)
     - created_at: TIMESTAMP
   - pgvector IVFFlat index created for fast similarity search:
     ```sql
     CREATE INDEX ON agent_memory
     USING ivfflat (embedding vector_cosine_ops)
     WITH (lists = 100);
     ```
   - Index type: IVFFlat (Inverted File with Flat quantization)
   - Metric: Cosine similarity (vector_cosine_ops)
   - Trade-off: Speed vs accuracy (approximate nearest neighbors)

#### Part 2: Memory Retrieval (Application Phase)

5. **Next Task Starts** (Lines 86-95):
   - Agent receives new task: "Implement authentication system with token management"
   - Agent enters think phase

6. **Query Semantic Memory** (Lines 96-110):
   - Agent calls MemoryService.searchMemories(agentRole='DEV', namespace='coding_patterns', query='token management authentication', limit=5)
   - MemoryService validates parameters (agentRole valid, namespace non-empty, limit > 0)
   - MemoryService calls EmbeddingService.generateEmbedding(query)
   - Query embedding generated: 1536-dimensional vector

7. **Semantic Similarity Search** (Lines 111-145):
   - MemoryService executes pgvector query:
     ```sql
     SELECT
       id, agent_role, namespace, content,
       importance, created_at,
       1 - (embedding <=> $1) AS similarity
     FROM agent_memory
     WHERE agent_role = $2
       AND namespace = $3
     ORDER BY embedding <=> $1
     LIMIT $4;
     ```
   - Operator `<=>`: Cosine distance (0 = identical, 2 = opposite)
   - similarity = 1 - distance (converts to 0-1 range)
   - IVFFlat index scan for approximate nearest neighbors
   - Filter by similarity >= 0.7 (Requirement 7.6)
   - **Threshold explanation**: Only memories with ≥70% semantic match are relevant

8. **Rank Results** (Lines 146-165):
   - MemoryService applies ranking formula:
     ```
     rank = similarity × 0.7 + (importance / 10) × 0.3
     ```
   - **Example**:
     - Memory A: similarity=0.9, importance=8 → rank = 0.9×0.7 + 0.8×0.3 = 0.87
     - Memory B: similarity=0.8, importance=10 → rank = 0.8×0.7 + 1.0×0.3 = 0.86
     - Memory A ranks higher despite lower importance
   - Sort by rank descending
   - Return top-k results (k=limit)

9. **Enrich Context with Memories** (Lines 166-185):
   - Agent receives MemorySearchResult[] with top-5 memories
   - Agent adds memories to LLM prompt:
     ```
     You are implementing authentication.
     
     **Relevant past experiences:**
     1. [Memory 1: JWT with refresh token rotation - similarity 0.92]
     2. [Memory 2: Token expiry best practices - similarity 0.85]
     ...
     
     Use these insights to guide your implementation.
     ```
   - Agent calls LLM with enriched context
   - LLM benefits from past experience, produces better output

10. **Better Decision Making** (Lines 186-195):
    - Agent completes task with higher quality
    - **Learning Feedback Loop**:
      1. Complete task
      2. Extract lesson
      3. Store with embedding
      4. Retrieve on similar future task
      5. Apply lesson → better outcome
      6. Store new lesson
      → Continuous improvement

### Design Patterns Highlighted

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **Repository Pattern** | MemoryService abstracts vector database access | Decouples storage from business logic |
| **Strategy Pattern** | EmbeddingService supports multiple embedding models (OpenAI, Hugging Face) | Pluggable embedding providers |
| **Observer Pattern** | Memory save events trigger analytics and monitoring | Decoupled side effects |
| **Lazy Loading** | Embeddings generated on-demand, not eagerly | Performance optimization |

### Memory Isolation (Requirement 8)

**Namespace Isolation Mechanism**:
- Each agent has separate namespace (CEO: 'strategy', DEV: 'coding_patterns')
- searchMemories() filters by agentRole (WHERE agent_role = $1)
- DEV agent cannot access CEO memories (different agentRole)
- Prevents cross-role information leakage
- Ensures role-specific learning (DEV learns coding, CEO learns strategy)

**Example Violation (prevented by system)**:
```typescript
// This would fail validation
devAgent.searchMemories(
  agentRole: 'CEO',  // ❌ DEV cannot query CEO namespace
  namespace: 'strategy',
  query: '...'
);
```

### Algorithm: Semantic Search

**Input**: query string, agentRole, namespace, limit  
**Output**: Top-k memories ranked by relevance

**Steps**:
1. Generate query embedding (1536-dim vector) - O(1) API call
2. Query pgvector with cosine similarity - O(log n) with IVFFlat index
3. Filter by agentRole (namespace isolation) - O(1) index scan
4. Filter by namespace (e.g., 'coding_patterns') - O(1) index scan
5. Filter by similarity >= 0.7 (quality threshold) - O(m) where m = candidates
6. Rank by: similarity × 0.7 + (importance/10) × 0.3 - O(k) where k = limit
7. Sort descending, return top-k - O(k log k)

**Total Complexity**: O(log n + k log k) ≈ O(log n) for small k

### Timing Constraints

| Operation | Max Duration | Rationale |
|-----------|--------------|-----------|
| Embedding generation (save) | < 500ms | Non-blocking, background |
| Embedding generation (search) | < 500ms | Blocks agent think phase |
| Vector search | < 200ms | pgvector IVFFlat performance |
| Ranking | < 50ms | In-memory computation |
| Total memory retrieval | < 1 second | Agent think phase budget |
| Memory save (total) | < 300ms | Async, doesn't block agent |

### Key Invariants

1. **All memories have embeddings**: NOT NULL constraint on embedding column
2. **Importance ∈ [1, 10]**: CHECK constraint enforced by database
3. **Similarity scores ∈ [0, 1]**: Mathematical property of cosine similarity
4. **Results always filtered by agentRole**: Enforced by WHERE clause (Requirement 8)
5. **Search returns at most 'limit' results**: LIMIT clause guarantees
6. **Results sorted by rank descending**: ORDER BY rank DESC

### Preconditions

- EmbeddingService has valid API key for LLM provider
- PostgreSQL has pgvector extension installed (CREATE EXTENSION vector)
- AgentMemory table has IVFFlat index on embedding column
- Agent exists in Agent table (foreign key constraint)
- Namespace is non-empty string
- Query is non-empty string
- Importance is integer between 1 and 10

### Postconditions

**After Memory Save**:
- AgentMemory record exists with id, embedding, importance, created_at
- Embedding is 1536-dimensional vector (for text-embedding-ada-002)
- Importance is clamped to [1, 10] if input was invalid
- Memory is immediately searchable (index updated)

**After Memory Search**:
- All returned memories have similarity >= 0.7
- All returned memories have agentRole matching query (namespace isolation)
- Results are sorted by rank descending
- At most 'limit' results returned
- Each result has similarity, importance, rank, content fields populated

---

## SD-006: Workflow Rollback

### Overview

**Diagram ID**: SD-006  
**Title**: Workflow Rollback (Compensating Transactions)  
**File**: `docs/diagrams/sequences/SD-006-workflow-rollback.puml`  
**Primary Use Case**: UC-012 (Execute DAG Workflow), UC-019 (Error Handling and Retry Logic)  
**Business Context**: Distributed transaction management using Saga pattern to maintain system consistency on workflow failure.

### Purpose and Context

This sequence diagram models the workflow rollback mechanism that executes compensating transactions when a workflow step fails after exhausting retries. It demonstrates:

1. **Saga Pattern** for distributed transaction management
2. **Compensating transactions** executed in reverse order
3. **Retry logic with exponential backoff** (Requirement 19)
4. **Transactional consistency** across multi-agent workflow
5. **Fault tolerance** and system recovery

This is the most complex error-handling diagram, essential for enterprise-grade reliability.

### Participants

| Participant | Type | Role |
|-------------|------|------|
| WorkflowEngine | System Component | Orchestrates workflow, detects failures, triggers rollback |
| WorkflowStep | Entity | Records execution state per workflow node |
| CompensationService | System Component | Plans and executes compensating transactions |
| PrismaDB | External System | Persistent storage, transactional guarantees |
| CEOAgent, PMAgent, DEVAgent | AI Agents | Notified of rollback, learn from failure |
| WebSocketGateway | System Component | Real-time notifications to Board Member |
| BoardMember | Human Actor | Receives rollback alerts, decides next action |

### Main Flow Description

1. **Workflow Execution in Progress** (Lines 1-25):
   - WorkflowEngine processing node 'dev_implementation'
   - 3 steps completed: CEO created milestones, PM created tasks, DEV started implementation
   - Current step: DEV writes code in sandbox
   - DEV executes tool 'code_execution' with 'npm test'
   - **Failure**: Docker container timeout after 30 seconds
   - DEV returns error: "Sandbox timeout - container unresponsive"

2. **Error Detection & Retry Logic** (Lines 26-60):
   - WorkflowEngine.handleNodeFailure() catches error
   - **Requirement 19: Exponential Backoff Retry**:
     - Attempt 1: immediate
     - Attempt 2: 2^1 = 2 seconds delay
     - Attempt 3: 2^2 = 4 seconds delay
     - Attempt 4: 2^3 = 8 seconds delay
   - maxRetries = node.maxRetries || 3
   - retryCount = step.retryCount + 1
   - If retryCount <= maxRetries:
     - WebSocket emits WorkflowRetryEvent { attempt: 2, maxRetries: 3, delay: 2000 }
     - delay(backoffDelay)
     - Retry executeNode()
   - If retryCount > maxRetries:
     - Max retries exceeded, initiate rollback
     - **Rollback Decision**: After 3 failed retries, workflow cannot proceed forward

3. **Identify Compensation Actions** (Lines 61-90):
   - WorkflowEngine calls CompensationService.identifyCompensationActions(runId)
   - CompensationService queries database for completed WorkflowSteps
   - Returns: [
       { id, nodeId: 'ceo_plan', status: 'completed', agentRole: 'CEO', output: {...} },
       { id, nodeId: 'pm_breakdown', status: 'completed', agentRole: 'PM', output: {...} }
     ]
   - CompensationService.reverseSteps(completedSteps)
   - **Reverse Order Execution**: Compensating transactions must execute in reverse to maintain consistency
     - Forward: CEO → PM → DEV
     - Rollback: DEV → PM → CEO
   - CompensationService.buildCompensationPlan():
     - PM compensation: deleteTasks (remove 15 tasks created by PM)
     - CEO compensation: deleteMilestones (remove 3 milestones created by CEO)

4. **Execute Compensating Transactions** (Lines 91-220):
   - WebSocket emits WorkflowRollbackStartedEvent
   - Board Member notified: "Workflow rollback started, 2 steps to undo"
   - **Loop**: For each compensation action (reverse order)
   
   **PM Compensation**:
   - CompensationService.executeCompensation(action)
   - action.agentRole == 'PM', action.action == 'delete_tasks'
   - Database: task.deleteMany({id: {in: action.data.taskIds}})
   - **Transactional Delete**: All 15 tasks deleted atomically within database transaction
   - **Referential Integrity**: Cascade deletes to TaskAssignments, TaskComments, TaskAttachments
   - PM agent notified: notifyRollback(stepId, reason)
   - PM saves memory: "Tasks rolled back due to downstream failure" (importance=7)
   - Compensation log created: compensationLog.create({workflowRunId, action: 'delete_tasks', status: 'success', taskIds: [...]})
   - WebSocket emits CompensationStepCompletedEvent
   
   **CEO Compensation**:
   - action.agentRole == 'CEO', action.action == 'delete_milestones'
   - Database: milestone.deleteMany({id: {in: action.data.milestoneIds}})
   - **Cascade Constraint Check**: Verify no tasks reference these milestones (already deleted by PM compensation)
   - CEO agent notified
   - CEO saves memory: "Milestones rolled back due to downstream failure" (importance=7)
   - Compensation log created
   - WebSocket emits CompensationStepCompletedEvent

5. **Update Workflow Status** (Lines 221-245):
   - WorkflowEngine updates WorkflowRun:
     - status: 'failed'
     - failedAt: now()
     - failureReason: 'Step failure after max retries'
     - compensationCompleted: true
   - WorkflowEngine updates Project:
     - status: 'failed'
     - failureReason: 'Workflow rollback completed'

6. **Notify Stakeholders** (Lines 246-270):
   - WebSocket emits WorkflowRollbackCompletedEvent to Board Member
   - Message includes:
     - workflowRunId, projectId
     - originalError: 'Sandbox timeout'
     - compensationActions: [
         { action: 'delete_tasks', status: 'success', count: 15 },
         { action: 'delete_milestones', status: 'success', count: 3 }
       ]
     - timestamp: now()
   - Board Member sees:
     - Workflow failed
     - All changes rolled back
     - System state consistent
     - Can safely retry or abandon project
   - Structured log: {event: 'workflow_rollback', workflowRunId, projectId, compensationActionsCount: 2, status: 'success'}

### Design Patterns Highlighted

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **Saga Pattern** | Distributed transaction with compensating transactions in reverse order | Atomicity across multiple steps without 2PC |
| **Command Pattern** | Each compensation action is a reversible Command object | Encapsulates undo operations |
| **Memento Pattern** | WorkflowStep stores state (output) for rollback | Captures state before execution |
| **Chain of Responsibility** | Compensation actions chained in reverse order | Sequential undo with proper ordering |
| **Strategy Pattern** | Different compensation strategies per agent role | Role-specific rollback logic |

### Saga Pattern Implementation

**Forward Transactions** (T1, T2, T3):
- T1: CEO creates milestones
- T2: PM creates tasks
- T3: DEV implements code (FAILED)

**Compensating Transactions** (C3, C2, C1):
- C3: DEV cleanup (none, as it failed before creating artifacts)
- C2: PM deletes tasks
- C1: CEO deletes milestones

**Guarantee: Atomicity**:
- Either all steps succeed, or all are compensated, leaving system in consistent state
- No partial commits (unlike 2-phase commit, which can deadlock)

### Synchronous vs Asynchronous Interactions

**Synchronous**:
- WorkflowEngine → CompensationService (compensation planning blocks)
- CompensationService → Database (transactional deletes must complete)
- CompensationService → Agents (notification blocks until acknowledged)

**Asynchronous**:
- WebSocket → Board Member (fire-and-forget notifications)
- Agent → saveMemory() (memory storage is background task)

### Timing Constraints

| Operation | Max Duration | Enforcement |
|-----------|--------------|-------------|
| Compensation identification | < 1 second | Database query |
| Per-compensation execution | < 5 seconds | Database transaction timeout |
| Total rollback time | < 30 seconds | For typical workflow (2-5 steps) |
| WebSocket notifications | < 500ms | Real-time delivery |
| Database transaction timeout | 10 seconds | PostgreSQL timeout |

### Key Invariants

1. **Compensations execute in strict reverse order**: CompensationService enforces via array reversal
2. **Each compensation is atomic**: Wrapped in database transaction (BEGIN...COMMIT)
3. **Compensation logs persisted before execution**: Write-ahead logging for audit trail
4. **Agent notifications are best-effort**: Non-blocking, failures logged but don't abort rollback
5. **Workflow status transitions atomically**: running → failed (no intermediate states)
6. **Project status updated after workflow status**: Maintains referential integrity
7. **All compensation results logged**: Audit trail for compliance

### Business Rules

- **BR-101**: Workflow can only roll back if at least one step completed (otherwise just mark as failed)
- **BR-102**: Compensation must execute for all completed steps (partial rollback not allowed)
- **BR-103**: Partial compensation leaves workflow in 'failed_partial_rollback' state (requires manual intervention)
- **BR-104**: Board Member notified immediately of rollback (real-time alert)
- **BR-105**: Agents notified asynchronously (best-effort)

### Alternative: Partial Compensation Failure

**Scenario**: If compensation fails (e.g., database unavailable):
1. Mark compensation as 'failed' in compensationLog
2. Persist compensation plan to database for recovery
3. Retry compensation with exponential backoff (max 5 retries)
4. If retries exhausted, alert admin for manual intervention
5. Workflow status: 'failed_partial_rollback'

**Compensation Idempotency**:
- All compensation actions are idempotent (safe to retry):
  - DELETE tasks WHERE id IN (...) - if already deleted, affects 0 rows (no-op)
  - DELETE milestones WHERE id IN (...) - same idempotency guarantee

### Recovery Scenarios

**Scenario 1: System crash during compensation**:
- On restart, WorkflowEngine.recoverWorkflows() detects workflows with status='failed' and compensationCompleted=false
- Resume compensation from last logged action (compensationLog.findLast())
- Idempotent operations ensure safe retry

**Scenario 2: Database unavailable during compensation**:
- Retry compensation with exponential backoff (max 5 retries)
- If all retries fail, mark workflow as 'failed_partial_rollback'
- Alert admin for manual intervention (email, Slack, PagerDuty)

**Scenario 3: Agent notification failure**:
- Log error but continue compensation (notifications are non-critical)
- Agent will discover rollback on next task poll (background sync)

### Postconditions

**After Successful Rollback**:
- WorkflowRun.status = 'failed', compensationCompleted = true
- Project.status = 'failed'
- All tasks created by PM are deleted (count=15)
- All milestones created by CEO are deleted (count=3)
- CompensationLog has 2 records with status='success'
- All affected agents have memories saved about rollback
- Board Member notified via WebSocket
- System state is consistent (no orphaned data)

**After Partial Rollback Failure**:
- WorkflowRun.status = 'failed_partial_rollback'
- CompensationLog has mixed status (some 'success', some 'failed')
- Admin alerted for manual cleanup
- Compensation plan persisted for retry

---

## Summary Table: All Sequence Diagrams

| ID | Title | Primary Actors | Key Patterns | Complexity | Purpose |
|----|-------|----------------|--------------|------------|---------|
| SD-001 | Project Creation Workflow | Board Member, CEOAgent, PMAgent | Template Method, State Machine, Strategy | Medium | End-to-end project initialization |
| SD-002 | Agent Think-Act Cycle | WorkflowEngine, BaseAgent, AgentStateMachine | State, Strategy, Observer, Template Method | High | Core agent execution model |
| SD-003 | Human Approval Flow | WorkflowEngine, ApprovalService, Board Member | State, State Machine, Observer, Command, Memento | Medium | Human-in-the-loop decision making |
| SD-004 | Task Delegation Chain | 8 Agents (CEO → BA → Architect → PM → DEV → QC → QA → Marketing) | Registry, Strategy, Template Method, Chain of Responsibility | Very High | OOAD workflow hand-offs |
| SD-005 | Agent Learning Cycle | BaseAgent, MemoryService, VectorStore | Repository, Strategy, Observer, Lazy Loading | High | Semantic memory storage and retrieval |
| SD-006 | Workflow Rollback | WorkflowEngine, CompensationService, Agents | Saga, Command, Memento, Chain of Responsibility | Very High | Distributed transaction rollback |

### Coverage Analysis

**Use Cases Covered**:
- UC-001: Create Project (SD-001)
- UC-003: Approve Workflow Step (SD-003)
- UC-012: Execute DAG Workflow (SD-006)
- UC-013: Execute Agent Task Node (SD-002)
- UC-016-023: Agent execution (SD-001, SD-002, SD-004)
- UC-025: Agent Delegation Chain (SD-004)
- UC-026: Store Agent Memory (SD-005)
- UC-027: Search Semantic Memory (SD-005)

**Design Patterns Covered**:
- State Pattern: SD-002, SD-003
- Strategy Pattern: SD-001, SD-002, SD-004
- Observer Pattern: SD-001, SD-002, SD-003, SD-005
- Template Method: SD-001, SD-002
- Chain of Responsibility: SD-004, SD-006
- Command Pattern: SD-003, SD-004, SD-006
- Memento Pattern: SD-003, SD-006
- Saga Pattern: SD-006
- Factory Pattern: SD-001, SD-002
- Repository Pattern: SD-005
- Circuit Breaker: SD-002

**SOLID Principles Demonstrated**:
- **Single Responsibility Principle (SRP)**: Each agent has one role (SD-004)
- **Open/Closed Principle (OCP)**: Strategy interfaces allow extension without modification (SD-002)
- **Liskov Substitution Principle (LSP)**: All agents inherit BaseAgent and are interchangeable (SD-002)
- **Interface Segregation Principle (ISP)**: Separate IThinkingStrategy and IActionStrategy (SD-002)
- **Dependency Inversion Principle (DIP)**: Agents depend on abstractions (MemoryService, LLMProvider) not concretions (SD-002, SD-005)

### Academic Significance

These sequence diagrams demonstrate:

1. **Advanced OOP design**: 11 design patterns across 6 diagrams
2. **Enterprise architecture**: Multi-agent orchestration, distributed transactions, fault tolerance
3. **Real-time systems**: WebSocket integration for sub-second notifications
4. **AI integration**: LLM-powered agents with semantic memory
5. **Scalability**: Asynchronous processing via BullMQ, vector search with pgvector
6. **Reliability**: Saga pattern, compensating transactions, exponential backoff retry

This documentation package is suitable for:
- Thesis submission (Chapter 4: System Design)
- Academic peer review
- IEEE publication
- Conference presentation
- Industry adoption

---

## References

- **UML 2.5 Specification**: Object Management Group (OMG), 2015
- **Design Patterns**: Gamma et al., "Design Patterns: Elements of Reusable Object-Oriented Software", 1994
- **Enterprise Integration Patterns**: Hohpe & Woolf, 2003
- **Microservices Patterns**: Richardson, 2018
- **Saga Pattern**: Garcia-Molina & Salem, "Sagas", ACM SIGMOD, 1987
- **Circuit Breaker Pattern**: Nygard, "Release It!", 2007
- **pgvector Documentation**: https://github.com/pgvector/pgvector
- **PlantUML Documentation**: https://plantuml.com/sequence-diagram

---

**Document Version**: 1.0  
**Last Updated**: 2024-10-13  
**Author**: AI-CORP Development Team  
**Status**: Final - Ready for Thesis Submission
