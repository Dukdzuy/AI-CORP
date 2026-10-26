# **IMPLEMENTATION PLAN - AI-CORP OOAD Refactoring & Enhancement**

## **Problem Statement**

The AI-CORP platform is a multi-agent system for enterprise workflow automation, currently built with NestJS backend and React frontend. While functional, the codebase has architectural issues:

1. **Abandoned Domain Layer**: Well-designed domain interfaces (IAgent, IThinkingStrategy) exist but are unused by concrete implementations
2. **SOLID Violations**: BaseAgent has 9 dependencies and multiple responsibilities; services mix business logic with data access
3. **Missing Patterns**: No Repository pattern, no Domain Events, no CQRS separation
4. **Limited Agent Capabilities**: Only 5 agents (CEO, PM, DEV, QA, Marketing); needs expansion to BA, Architect and QC (QA/QC split)
5. **Incomplete Documentation**: No formal use case diagrams, sequence diagrams, or academic-grade specifications

**Goal**: Transform AI-CORP into an exemplary academic thesis project by:
- Applying full OOAD methodology with comprehensive UML documentation
- Refactoring to follow SOLID principles and design patterns
- Adding new agent roles and advanced workflow features
- Implementing full TDD with 90%+ test coverage
- Creating IEEE-standard documentation for thesis submission

**Timeline**: 7 weeks (mid-October to early December demo)

---

## **Status & Audit (2026-10-26)**

> Snapshot taken before starting Phase 3. Phases 1, 2 and 2.5 are complete; the audit below lists what was wrong in them and how it was fixed, the agent roster change, and the corrected direction for the remaining phases.

### **Phase status**

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 – Foundation & Documentation | Done | UML/use-case docs in `docs/`. Actor list updated: DevOps removed, QC added (see role review) |
| Phase 2 – Domain Layer Refactoring | Done (fixed) | Repositories, entities, application services (PR #2), engine strategies (PR #4), agent typing (PR #5) |
| Phase 2.5 – OOAD Project Automation | Done (fixed) | Templates + skeleton (PR #3). Quality gate, traceability and metrics were not wired end-to-end; fixed in this audit |
| Phase 3 – Agent System Enhancement | **In progress** | Re-scoped below. Task 11 done (2026-10-26); Tasks 12–15 next |
| Phases 4–7 | Not started | DevOps references removed |

### **Audit findings and fixes**

| # | Phase / Task | Finding | Fix |
|---|--------------|---------|-----|
| A1 | 2 / Task 8 | **API could not start**: `PmActionStrategy` and `MarketingActionStrategy` took `systemPrompt: string, modelConfig` constructor params, which Nest DI cannot resolve (`Nest can't resolve dependencies of the PmActionStrategy`) | Prompts/configs are class fields; app boots (verified) |
| A2 | 2 / Task 8 | Only BA/Architect/Dev/DevOps used the Strategy pattern; CEO, PM, QA and Marketing still ran legacy `think()/act()`, so their strategies (incl. the Phase 2.5 traceability in `QaActionStrategy`) were dead code | All 8 agents now run through injected thinking/action strategies |
| A3 | 2 / Task 10 | Budget enforcement for LLM cost bypassed the domain: `ApiUsageService` paused the project directly and never raised `BudgetExceededEvent`, so the running workflow was never paused | `ApiUsageService` publishes `BudgetExceededEvent` once when the budget is crossed; `BudgetExceededHandler` pauses the run |
| A4 | 2.5 / Tasks 10.2–10.5 | Strategy-based agents called the LLM provider directly, so **their token cost was never tracked** (BA, Architect, Dev, DevOps) | `UsageTrackingLLMProvider` (Decorator) + `AgentLLMService` (Facade): every agent call is logged to `ApiUsageLog` and accrued to the project |
| A5 | 2.5 / all | Artifacts were written into the Docker sandbox, which runs every command in a fresh container with no mounts, so **generated docs/code/tests were lost** after each command; the gate's file checks and QA's test scan could never succeed | New `ProjectWorkspace` (persistent store under `PROJECTS_WORKSPACE_DIR/projects/<id>/`, path-traversal safe). BA, Architect, Dev and QC write there; the sandbox is only for running commands |
| A6 | 2.5 / Task 10.4 | `QualityGateHandler` existed but was **never registered or used**: no `quality_gate` node type, no gate in the default workflow | `quality_gate` node type + `QualityGateStrategy` (self-registers with the engine, OCP). Default workflow: `design → ooad_gate → breakdown` (pass) / `→ design` (fail) |
| A7 | 2.5 / Task 10.4 | Workflow order contradicted OOAD: CEO → **PM** → BA → Architect → Dev (tasks planned before requirements existed) | CEO → BA → Architect → OOAD gate → PM → Dev → QC → QA → Marketing → approval → CEO close-out. PM now plans one task per approved use case |
| A8 | 2.5 / Task 10.6 | Traceability could never report coverage > 0% (nobody wrote tests; test files lived in throwaway containers) | QC agent writes acceptance tests per use case and builds the traceability matrix (use case → classes → implementation → tests) from the workspace |
| A9 | 2.5 / Task 10.7 | OOAD metrics controller was mounted at `/api/api/ooad-metrics` (`@Controller('api/ooad-metrics')` + global prefix) | `@Controller('ooad-metrics')` → `/api/ooad-metrics/...` |
| A10 | Phase 2 / Task 32.2 legacy | Kanban updates were broken: QA moved `in_progress → done` (invalid transition), QA approval was read from a field that never existed, nothing moved tasks out of `todo` | DEV: todo/in_progress → review; QA approve: review → done; QA reject: review → in_progress (via `Task.transitionTo`) |
| A11 | Workflow end node | CEO's `complete_project` step re-ran milestone planning and created duplicate milestones | CEO strategy branches on `taskType`; close-out writes a report, no milestones |
| A12 | Seed / UI | BA and Architect had no `Agent` rows (no memories, no model config in Agent Settings) and were missing from the Virtual Office | Seed adds BA, ARCHITECT, QC (DEVOPS deactivated); web role maps and Virtual Office list all 8 roles |
| A13 | Web | 5 TypeScript errors (`tsc --noEmit`) in Dashboard, ProjectDetail, VirtualOffice | Fixed; `tsc` and `vite build` clean |

**Verification**: `nest build` 0 errors, Jest 21/21 suites (351 tests), web `tsc` clean. Full workflow run end-to-end against PostgreSQL with a mock LLM: gate passed, 2 use-case tasks moved todo → review → done, every role logged usage, 28 files persisted in the workspace (an unsafe `../../etc/evil.ts` path from the "LLM" was rejected), traceability 80%, metrics endpoint correct, human approval → CEO close-out → `completed`.

**Known gaps carried into later phases** (not regressions): ~~`domain/agent/strategies/ThinkingStrategy.ts` duplicates the module strategies~~ (removed in Task 11); `MetricsHandler` / `AuditLogHandler` / `NotificationHandler` are stubs (Phase 5); `EmbeddingService` needs `OPENAI_API_KEY` or memory search returns nothing (Task 14); Jest's 90% global coverage threshold fails `jest --coverage` today (Task 27); generated tests are written but not executed yet (Task 12). ~~Phase 1 class/sequence/activity diagrams still mention DevOps~~ (refreshed in Task 11).

### **Agent role review**

**DevOps – removed.** AI-CORP's product is the *designed and implemented* project (OOAD artifacts + layered code + tests), not a running deployment. The DevOps agent was never part of the workflow, only produced LLM text that nothing consumed, and there is no deployment target in the platform (the sandbox has no network and no persistent volume). Keeping it would add a role with no verifiable output and pull the thesis scope towards CI/CD/IaC, away from OOAD. Deploying the *platform itself* (Task 32) is unaffected. If deployable output is wanted later, the Architect's skeleton can emit a Dockerfile template instead of a separate agent.

**QC – added, and QA re-focused.** In software quality management, *Quality Assurance* is process-oriented (prevent defects: standards, reviews, gates) and *Quality Control* is product-oriented (detect defects: test, inspect, measure). The old QA agent mixed both and in practice did neither well. The split maps directly onto OOAD's traceability chain:

| Role | Owns | Output |
|------|------|--------|
| **QA** (process) | OOAD quality gate after design; review of code against use cases, domain model, patterns, layering | `qa_approved` verdict that drives the QA condition (loop back to DEV on fail) |
| **QC** (product) | Acceptance tests derived from each use case; traceability matrix; coverage | `tests/UC-xxx.spec.ts`, `docs/traceability-matrix.md`, `ooadMetadata.testCoverage`, `qc_passed` |

**Current roster (8)**: CEO, BA, Architect, PM, DEV, QC, QA, Marketing.

**Current default workflow** (`apps/api/src/modules/workflow/default-workflow.ts`, v2.0.0):

```
CEO (milestones) → BA (use cases) → Architect (domain model, diagrams, patterns, skeleton)
  → [quality_gate: OOAD gate] ─fail→ Architect
  → PM (one task per use case) → DEV (implementation) → QC (acceptance tests + traceability)
  → QA (design conformance) → [condition qa_approved] ─fail→ DEV
  → Marketing → [human approval] → CEO (close-out)
```

### **Direction corrections for the remaining plan**

1. **Phase 3 no longer re-implements BA and Architect** (done in 2.5). It focuses on what makes the agent system itself OOAD-clean and verifiable: registry/OCP, executable QC, artifact visibility, learning, collaboration.
2. **Generated projects are first-class artifacts**: everything an agent produces lives in the project workspace and must be viewable/downloadable (Task 13) — this is the main thesis evidence.
3. **Quality is measured, not asserted**: QC executes tests (Task 12), so traceability coverage reflects passing tests, and Phase 6's analytics can use real data.
4. Recommendation (not applied): NFR2.1's 90% global unit coverage is very ambitious for the remaining weeks; consider gating 90% on `src/domain` + application services/strategies and reporting the rest.

---

## **Requirements**

### **Functional Requirements (FR)**

**FR1. Enhanced Multi-Agent System**
- FR1.1: Add new agent roles: Business Analyst (BA), Software Architect, Quality Control (QC) Engineer (DevOps dropped on 2026-10-26, see Status & Audit)
- FR1.2: Implement agent learning capability through memory refinement
- FR1.3: Support agent collaboration patterns (pair programming, code review chains)
- FR1.4: Enable agent delegation and sub-task assignment

**FR2. Advanced Workflow Engine**
- FR2.1: Support sub-workflows and workflow composition
- FR2.2: Implement workflow versioning and rollback mechanisms
- FR2.3: Add parallel execution optimization with dependency resolution
- FR2.4: Support workflow templates and reusable patterns

**FR3. Enterprise Features**
- FR3.1: Implement role-based access control (RBAC) with granular permissions
- FR3.2: Add comprehensive audit logging for compliance
- FR3.3: Create integration APIs for external tool connectivity
- FR3.4: Implement data export and reporting capabilities

**FR4. AI/ML Features**
- FR4.1: Agent performance metrics and learning analytics
- FR4.2: Task estimation ML model based on historical data
- FR4.3: Code quality prediction using static analysis patterns
- FR4.4: Auto-optimization suggestions for workflow efficiency

### **Non-Functional Requirements (NFR)**

**NFR1. Architecture Quality**
- NFR1.1: All code must follow SOLID principles
- NFR1.2: Minimum 15 design patterns applied appropriately
- NFR1.3: Clear separation between domain, application, and infrastructure layers
- NFR1.4: Dependency injection used throughout

**NFR2. Test Coverage**
- NFR2.1: Unit test coverage ≥ 90%
- NFR2.2: Integration test coverage ≥ 80%
- NFR2.3: E2E test coverage for all critical user journeys
- NFR2.4: Performance tests for workflow execution (≤2s per node)

**NFR3. Documentation**
- NFR3.1: Complete use case diagrams for all actor interactions
- NFR3.2: Class diagrams for all domain models and patterns
- NFR3.3: Sequence diagrams for critical workflows
- NFR3.4: Activity diagrams for complex business processes
- NFR3.5: State diagrams for stateful entities (agents, workflows, tasks)
- NFR3.6: Component and deployment diagrams for architecture
- NFR3.7: IEEE-format thesis documentation

---

## **Background Research**

### **1. OOAD Fundamentals**

**Use Case Modeling** (Jacobson, 1992):
- Captures functional requirements from user perspective
- Actors: External entities interacting with system (Board Member, Admin, AI Agents)
- Use Cases: System behaviors providing value to actors
- Relationships: Include (mandatory sub-behavior), Extend (optional enhancement), Generalization (inheritance)

**UML 2.5 Specification**:
- **Structural Diagrams**: Class, Object, Component, Deployment, Package, Composite Structure
- **Behavioral Diagrams**: Use Case, Sequence, Activity, State Machine, Communication, Timing, Interaction Overview
- Best Practice: Start with Use Case → Class → Sequence for core features

**Requirements Engineering**:
- Functional vs Non-Functional Requirements
- Traceability Matrix: Link requirements → design → implementation → tests
- Acceptance Criteria: Testable conditions for requirement satisfaction

### **2. Design Patterns (Gang of Four + Enterprise)**

**Creational Patterns**:
- **Factory Method**: Create agent instances without specifying exact class (already partially implemented in LLMProviderFactory)
- **Abstract Factory**: Create families of related objects (Agent + Strategy + Memory combinations)
- **Builder**: Construct complex workflow definitions step-by-step
- **Prototype**: Clone agent configurations for similar roles
- **Singleton**: Ensure single instance of WorkflowEngine, EventBus

**Structural Patterns**:
- **Adapter**: Integrate external LLM providers with uniform interface (ILLMProvider already exists)
- **Decorator**: Add responsibilities to agents dynamically (logging, metrics, caching)
- **Facade**: Simplify complex subsystem interfaces (AgentOrchestrator facade over agent registry)
- **Composite**: Tree structure for hierarchical workflows (sub-workflows)
- **Proxy**: Control access to agents (permission checking, lazy initialization)

**Behavioral Patterns**:
- **Strategy**: Encapsulate algorithm variations (IThinkingStrategy, IActionStrategy - already defined but unused)
- **Observer**: Event notification system (AgentEventEmitter exists but not integrated)
- **Command**: Encapsulate workflow actions as objects (WorkflowCommand pattern)
- **Chain of Responsibility**: Agent delegation chain (BA → Architect → PM → DEV)
- **State**: Manage agent/workflow state transitions (AgentStateMachine exists but unused)
- **Template Method**: Define algorithm skeleton (BaseAgent.execute() already uses this)
- **Mediator**: Centralize agent communication (AgentMessageBus)
- **Memento**: Capture workflow state for rollback
- **Visitor**: Separate workflow traversal from node operations

**Enterprise Patterns** (Fowler, 2002):
- **Repository**: Abstract data persistence (IProjectRepository, ITaskRepository)
- **Unit of Work**: Manage transaction boundaries
- **Data Mapper**: Separate domain objects from database schema
- **Service Layer**: Define application boundaries and transaction control
- **Domain Event**: Decouple domain logic with event-driven communication
- **Specification**: Encapsulate business rules as reusable objects

### **3. Multi-Agent Systems Architecture**

**BDI (Belief-Desire-Intention) Architecture** (Rao & Georgeff, 1995):
- **Beliefs**: Agent's knowledge about environment (memories in AgentMemory table)
- **Desires**: Agent's goals (tasks assigned to agent)
- **Intentions**: Committed plans for achieving goals (workflow nodes in progress)
- Application: Map agent think-act cycle to BDI model

**Agent Communication Protocols**:
- **FIPA-ACL** (Foundation for Intelligent Physical Agents - Agent Communication Language):
  - Performatives: REQUEST, INFORM, QUERY, PROPOSE, ACCEPT, REJECT
  - Current implementation uses ad-hoc AgentMessage; refactor to FIPA standards
- **Contract Net Protocol**: Task allocation through bidding
  - Agents bid on tasks based on capabilities
  - Orchestrator selects best agent per task

**Agent Coordination Patterns**:
- **Blackboard Architecture**: Shared workspace for collaborative problem-solving
  - WorkflowContext acts as blackboard
  - Agents read/write shared variables
- **Organizational Structure**: Hierarchical (CEO→PM→DEV) vs Flat collaboration
- **Negotiation**: Agents negotiate task parameters and resources

### **4. Workflow Engine Patterns**

**BPMN 2.0** (Business Process Model and Notation):
- Standard for business process modeling
- Elements: Tasks (agent_task), Gateways (condition), Events (human_approval), Sub-processes
- Current WorkflowDefinition maps well to BPMN; add standard icons in diagrams

**Petri Nets**:
- Mathematical model for distributed systems
- Places (workflow states), Transitions (node executions), Tokens (workflow instances)
- Use for formal verification of workflow correctness (no deadlocks)

**State Machines**:
- Finite State Machine (FSM) for deterministic workflows
- Hierarchical State Machine (HSM) for nested sub-workflows
- UML State Machine diagram for agent and workflow states

**Process Orchestration vs Choreography**:
- **Orchestration**: Central coordinator (WorkflowEngine) controls flow - current approach
- **Choreography**: Decentralized, agents self-coordinate - future enhancement
- Hybrid: Orchestration for structured workflows, choreography for ad-hoc collaboration

---

## **Proposed Solution**

### **Architecture Overview**

**Layered Architecture with DDD** (Domain-Driven Design):

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ REST Controllers │  │ WebSocket Gateway│                │
│  │ (NestJS)         │  │ (Socket.IO)      │                │
│  └──────────────────┘  └──────────────────┘                │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                    Application Layer                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Use Case   │ │ Application│ │ DTO        │             │
│  │ Services   │ │ Services   │ │ Mappers    │             │
│  └────────────┘ └────────────┘ └────────────┘             │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                      Domain Layer                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Entities   │ │ Value      │ │ Domain     │             │
│  │ Aggregates │ │ Objects    │ │ Services   │             │
│  ├────────────┤ ├────────────┤ ├────────────┤             │
│  │ Agent      │ │ AgentRole  │ │ Agent      │             │
│  │ Workflow   │ │ NodeType   │ │ Orchestration│           │
│  │ Task       │ │ TaskStatus │ │ Workflow   │             │
│  │ Project    │ │ Money      │ │ Execution  │             │
│  └────────────┘ └────────────┘ └────────────┘             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Interfaces │ │ Domain     │ │ Specifications│          │
│  │ (IAgent,   │ │ Events     │ │ (Business  │             │
│  │ IStrategy) │ │            │ │ Rules)     │             │
│  └────────────┘ └────────────┘ └────────────┘             │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                  Infrastructure Layer                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Repositories│ │ External   │ │ Persistence│             │
│  │ (Prisma)   │ │ Services   │ │ (PostgreSQL)│            │
│  │            │ │ (LLM, Redis)│ │            │             │
│  └────────────┘ └────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions**:

1. **Domain Layer Independence**: Domain entities have no dependencies on infrastructure (Prisma, NestJS)
2. **Repository Pattern**: All data access through IRepository interfaces, implemented in infrastructure layer
3. **Domain Events**: Entities emit events (AgentCompletedTaskEvent, WorkflowStateChangedEvent) handled by event bus
4. **CQRS Separation**: Command handlers for writes, Query services for reads
5. **Strategy Injection**: Agents receive IThinkingStrategy and IActionStrategy via constructor
6. **State Machine Integration**: Agents and Workflows use state machines for transition validation
7. **Agent Registry**: Replace switch statement with Map<AgentRole, IAgent> for Open/Closed Principle

### **Design Patterns Application**

| Pattern | Application | Location | Benefit |
|---------|-------------|----------|---------|
| **Factory Method** | AgentFactory creates agents with injected strategies | `domain/agent/AgentFactory.ts` | OCP: Add new agents without modifying factory |
| **Abstract Factory** | AgentEcosystemFactory creates Agent + Strategy + Memory bundles | `domain/agent/AgentEcosystemFactory.ts` | Consistent agent configuration families |
| **Builder** | WorkflowBuilder constructs complex workflow definitions | `domain/workflow/WorkflowBuilder.ts` | Fluent API for workflow creation |
| **Prototype** | Clone agent configurations for similar roles | `domain/agent/AgentPrototype.ts` | Avoid redundant configuration |
| **Singleton** | EventBus, WorkflowEngine single instances | `domain/events/EventBus.ts` | Global event coordination |
| **Adapter** | LLMProviderAdapter wraps external LLM APIs | `infrastructure/llm/adapters/` | Uniform interface for multiple providers |
| **Decorator** | AgentMetricsDecorator, AgentCachingDecorator | `domain/agent/decorators/` | Add cross-cutting concerns dynamically |
| **Facade** | AgentOrchestrationFacade simplifies agent invocation | `application/services/AgentOrchestrationFacade.ts` | Hide complexity from clients |
| **Composite** | Workflow contains sub-workflows recursively | `domain/workflow/CompositeWorkflow.ts` | Hierarchical workflow structures |
| **Proxy** | AgentPermissionProxy checks access before execution | `application/security/AgentPermissionProxy.ts` | Centralized authorization |
| **Strategy** | IThinkingStrategy, IActionStrategy per agent role | `domain/agent/strategies/` | SRP: Separate algorithm from agent class |
| **Observer** | EventBus with IEventHandler subscribers | `domain/events/EventBus.ts` | Decouple event publishers from subscribers |
| **Command** | WorkflowCommand encapsulates node execution | `domain/workflow/commands/` | Undo/redo, transaction management |
| **Chain of Responsibility** | AgentDelegationChain routes tasks through hierarchy | `domain/agent/AgentDelegationChain.ts` | Flexible task routing |
| **State** | AgentStateMachine, WorkflowStateMachine | `domain/agent/AgentStateMachine.ts` | Enforce valid state transitions |
| **Template Method** | BaseAgent.execute() defines skeleton | `domain/agent/BaseAgent.ts` | DRY: Reuse common execution flow |
| **Mediator** | AgentMessageBus coordinates agent communication | `domain/agent/AgentMessageBus.ts` | Reduce agent coupling |
| **Memento** | WorkflowSnapshot captures state for rollback | `domain/workflow/WorkflowSnapshot.ts` | Workflow versioning |
| **Visitor** | WorkflowNodeVisitor traverses workflow graph | `domain/workflow/visitors/` | Separate traversal from operations |
| **Repository** | IProjectRepository, ITaskRepository | `domain/repositories/` | DIP: Depend on abstractions not Prisma |
| **Unit of Work** | UnitOfWork manages transaction boundaries | `infrastructure/persistence/UnitOfWork.ts` | Atomic multi-entity operations |
| **Specification** | TaskPrioritySpecification, AgentCapabilitySpecification | `domain/specifications/` | Reusable business rules |

---

## **Task Breakdown**

### **Phase 1: Foundation & Documentation (Week 1-2)**

---

**Task 1: Requirements Analysis & Use Case Modeling**
- **Objective**: Create comprehensive use case documentation for all system actors
- **Implementation**:
  1. Identify all actors: Board Member, Admin, AI Agents (CEO, PM, DEV, QA, QC, Marketing, BA, Architect)
  2. Document use cases with templates:
     - **UC-001**: Create Project (Actor: Board Member)
     - **UC-002**: Approve Workflow Step (Actor: Board Member)
     - **UC-003**: Execute Development Task (Actor: DEV Agent)
     - **UC-004**: Analyze Requirements (Actor: BA Agent) [NEW]
     - **UC-005**: Design Architecture (Actor: Architect Agent) [NEW]
     - **UC-006**: Verify Implementation against Use Cases (Actor: QC Agent) [NEW, replaces Deploy Application]
     - ... (continue for all 25+ use cases)
  3. Create use case diagrams in PlantUML format
  4. Document pre-conditions, post-conditions, main flow, alternative flows, exception flows
  5. Create traceability matrix linking use cases to functional requirements
- **Tests**: N/A (documentation task)
- **Demo**: Present use case diagram showing all actor interactions and system boundary

---

**Task 2: Domain Model & Class Diagram Design**
- **Objective**: Design complete domain model with all entities, value objects, and relationships
- **Implementation**:
  1. Identify core entities: Agent, Workflow, Project, Task, Milestone, Approval, Memory
  2. Define value objects: AgentRole, TaskStatus, Money, TimeRange, AgentCapability
  3. Map aggregates and aggregate roots:
     - **Project Aggregate**: Project (root) → Milestone → Task
     - **Workflow Aggregate**: WorkflowDefinition (root) → WorkflowNode → WorkflowEdge
     - **Agent Aggregate**: Agent (root) → AgentMemory, AgentState
  4. Design interfaces: IAgent, IThinkingStrategy, IActionStrategy, IRepository, IEventHandler
  5. Create comprehensive class diagrams showing:
     - All 50+ classes with attributes and methods
     - Association, aggregation, composition relationships
     - Inheritance hierarchies
     - Interface implementations
     - Multiplicity and navigation
  6. Document design patterns applied in class diagram annotations
- **Tests**: N/A (documentation task)
- **Demo**: Present class diagram with pattern annotations, explain domain boundaries

---

**Task 3: Sequence Diagrams for Critical Workflows**
- **Objective**: Document dynamic behavior through sequence diagrams
- **Implementation**:
  1. Create sequence diagrams for:
     - **SD-001**: Project Creation Workflow (Board Member → ProjectController → ProjectService → Repository → EventBus → WorkflowEngine)
     - **SD-002**: Agent Think-Act Cycle (WorkflowEngine → AgentOrchestrator → Agent → LLMProvider → ToolExecutor)
     - **SD-003**: Human Approval Flow (Agent → WorkflowEngine → ApprovalService → WebSocket → Board Member → ApprovalController)
     - **SD-004**: Task Delegation Chain (CEO → PM → BA → Architect → DEV) [NEW]
     - **SD-005**: Agent Learning Cycle (Agent → MemoryService → VectorDB → Agent) [NEW]
     - **SD-006**: Workflow Rollback (Board Member → WorkflowEngine → MementoStore → Workflow) [NEW]
  2. Show object lifelines, message passing, activation bars, return values
  3. Annotate with design patterns (Factory, Strategy, Observer)
  4. Document timing constraints and synchronous/asynchronous calls
- **Tests**: N/A (documentation task)
- **Demo**: Walk through agent execution sequence diagram showing pattern applications

---

**Task 4: Activity & State Machine Diagrams**
- **Objective**: Model complex business processes and state transitions
- **Implementation**:
  1. **Activity Diagrams**:
     - **AD-001**: Complete Project Lifecycle (swimlanes for each agent role)
     - **AD-002**: Workflow Execution with Parallel Branches
     - **AD-003**: Task Estimation ML Pipeline [NEW]
     - **AD-004**: Code Quality Analysis Flow [NEW]
  2. **State Machine Diagrams**:
     - **SM-001**: Agent State Transitions (IDLE → THINKING → ACTING → WAITING → COMPLETED/ERROR)
     - **SM-002**: Workflow State Transitions (PENDING → RUNNING → PAUSED/COMPLETED/FAILED/CANCELLED)
     - **SM-003**: Task Status Transitions (TODO → IN_PROGRESS → REVIEW → DONE)
     - **SM-004**: Approval State Transitions (PENDING → APPROVED/REJECTED)
  3. Show guard conditions, entry/exit actions, internal transitions
- **Tests**: N/A (documentation task)
- **Demo**: Present activity diagram with concurrent flows and decision points

---

**Task 5: Component & Deployment Architecture**
- **Objective**: Document high-level architecture and deployment topology
- **Implementation**:
  1. **Component Diagram**:
     - Show major components: Frontend, API Gateway, Agent Module, Workflow Module, LLM Module, Persistence
     - Document interfaces between components (REST, WebSocket, gRPC)
     - Show dependencies and required/provided interfaces
  2. **Deployment Diagram**:
     - Nodes: Client Browser, API Server, PostgreSQL, Redis, Docker Sandbox, LLM Gateway
     - Artifacts deployed to nodes
     - Communication protocols and ports
  3. **Package Diagram**:
     - Show module dependencies (domain ← application ← infrastructure)
     - Enforce layering rules
- **Tests**: N/A (documentation task)
- **Demo**: Present deployment diagram showing scalability strategy (load balancers, replicas)

---

### **Phase 2: Domain Layer Refactoring (Week 2-3)**

---

**Task 6: Implement Repository Pattern**
- **Objective**: Abstract data access with repository interfaces following DIP
- **Implementation**:
  1. Define repository interfaces in `src/domain/repositories/`:
     ```typescript
     interface IProjectRepository {
       findById(id: string): Promise<Project | null>;
       save(project: Project): Promise<void>;
       delete(id: string): Promise<void>;
       findByUserId(userId: string): Promise<Project[]>;
     }
     interface ITaskRepository { ... }
     interface IMilestoneRepository { ... }
     interface IAgentRepository { ... }
     ```
  2. Implement repositories in `src/infrastructure/persistence/`:
     ```typescript
     @Injectable()
     class PrismaProjectRepository implements IProjectRepository {
       constructor(private prisma: PrismaService) {}
       async findById(id: string): Promise<Project | null> {
         const data = await this.prisma.project.findUnique({ where: { id } });
         return data ? ProjectMapper.toDomain(data) : null;
       }
       async save(project: Project): Promise<void> {
         const data = ProjectMapper.toPersistence(project);
         await this.prisma.project.upsert({ where: { id: data.id }, create: data, update: data });
       }
       // ... other methods
     }
     ```
  3. Create domain mappers: `ProjectMapper.toDomain()`, `ProjectMapper.toPersistence()`
  4. Replace all direct `PrismaService` injections in services with repository interfaces
- **Tests**:
  - Unit tests for repositories with mocked Prisma client
  - Integration tests verifying database operations
  - Test edge cases: null results, duplicate keys, concurrent updates
- **Demo**: Show repository abstraction allowing database swap (demo with in-memory repository)

---

**Task 7: Implement Domain Entities with Business Logic**
- **Objective**: Move business logic from services to rich domain entities
- **Implementation**:
  1. Create domain entities in `src/domain/entities/`:
     ```typescript
     class Project {
       private constructor(
         private readonly id: ProjectId,
         private name: string,
         private status: ProjectStatus,
         private budget: Money,
         private costAccrued: Money,
         private milestones: Milestone[]
       ) {}
       
       static create(name: string, description: string, goal: string, budget: Money): Project {
         // Factory method with validation
         if (!name || name.length < 3) throw new ValidationError('Name too short');
         return new Project(ProjectId.create(), name, ProjectStatus.ACTIVE, budget, Money.zero(), []);
       }
       
       addMilestone(milestone: Milestone): void {
         if (this.status !== ProjectStatus.ACTIVE) {
           throw new BusinessRuleViolation('Cannot add milestone to inactive project');
         }
         this.milestones.push(milestone);
         DomainEvents.raise(new MilestoneAddedEvent(this.id, milestone.id));
       }
       
       accrueCost(cost: Money): void {
         this.costAccrued = this.costAccrued.add(cost);
         if (this.costAccrued.greaterThan(this.budget)) {
           DomainEvents.raise(new BudgetExceededEvent(this.id));
         }
       }
       
       // ... other business methods
     }
     ```
  2. Create value objects: `Money`, `ProjectId`, `TaskStatus`, `AgentRole`
  3. Implement domain events: `MilestoneAddedEvent`, `BudgetExceededEvent`, `TaskCompletedEvent`
  4. Move validation from DTOs to domain entities
- **Tests**:
  - Unit tests for each entity method
  - Test business rule enforcement (e.g., cannot exceed budget)
  - Test domain event emission
  - Test value object immutability
- **Demo**: Show entity encapsulating business logic (demo `project.addMilestone()` validating state)

---

**Task 8: Implement Agent Strategy Pattern (IThinkingStrategy & IActionStrategy)**

> **2026-10-26:** completed for all 8 roles (CEO/PM/QA/Marketing were still on the legacy path). LLM access goes through `AgentLLMService` (Facade) and `UsageTrackingLLMProvider` (Decorator).
- **Objective**: Connect existing domain strategy interfaces to concrete agent implementations
- **Implementation**:
  1. Ensure strategy interfaces are complete in `src/domain/agent/strategies/`:
     ```typescript
     interface IThinkingStrategy {
       think(context: AgentContext): Promise<ThinkingResult>;
     }
     interface IActionStrategy {
       act(thought: ThinkingResult, context: AgentContext): Promise<ActionResult>;
     }
     ```
  2. Implement strategies for all agent roles:
     ```typescript
     class CEOThinkingStrategy implements IThinkingStrategy {
       async think(context: AgentContext): Promise<ThinkingResult> {
         // CEO-specific reasoning: analyze project goal, break into milestones
         const memories = await this.memoryService.searchMemories('planning', context.goal);
         const llmResult = await this.llmProvider.chat({ messages: [...] });
         return { plan: llmResult.content, confidence: 0.85 };
       }
     }
     
     class CEOActionStrategy implements IActionStrategy {
       async act(thought: ThinkingResult, context: AgentContext): Promise<ActionResult> {
         // CEO-specific actions: create milestones
         const milestones = this.parseMilestones(thought.plan);
         await this.projectRepository.addMilestones(context.projectId, milestones);
         return { success: true, output: milestones };
       }
     }
     ```
  3. Refactor `BaseAgent` to accept strategies via constructor:
     ```typescript
     abstract class BaseAgent implements IAgent {
       constructor(
         private readonly id: AgentId,
         private readonly role: AgentRole,
         private readonly thinkingStrategy: IThinkingStrategy,
         private readonly actionStrategy: IActionStrategy,
         private readonly eventEmitter: AgentEventEmitter,
         private readonly stateMachine: AgentStateMachine
       ) {}
       
       async execute(context: AgentContext): Promise<AgentResult> {
         this.stateMachine.transition(AgentState.THINKING);
         this.eventEmitter.emit('thinking_started', this.id, context.taskId);
         
         const thought = await this.thinkingStrategy.think(context);
         
         this.stateMachine.transition(AgentState.ACTING);
         const action = await this.actionStrategy.act(thought, context);
         
         this.stateMachine.transition(AgentState.COMPLETED);
         this.eventEmitter.emit('action_completed', this.id, action);
         
         return { thought, action };
       }
     }
     ```
  4. Update agent factory to inject strategies:
     ```typescript
     class AgentFactory {
       createAgent(role: AgentRole): IAgent {
         const strategies = this.strategyRegistry.getStrategies(role);
         return new Agent(
           AgentId.create(),
           role,
           strategies.thinking,
           strategies.action,
           this.eventEmitter,
           new AgentStateMachine()
         );
       }
     }
     ```
- **Tests**:
  - Unit tests for each strategy in isolation
  - Mock dependencies (LLMProvider, MemoryService, Repositories)
  - Test BaseAgent.execute() orchestration with mocked strategies
  - Integration tests verifying strategy swapping
- **Demo**: Show agent execution with swappable strategies (demo DEV agent with fast vs thorough strategies)

---

**Task 9: Implement Agent State Machine Integration**
- **Objective**: Enforce valid state transitions for agents using existing AgentStateMachine
- **Implementation**:
  1. Integrate `AgentStateMachine` into `BaseAgent` (started in Task 8)
  2. Add state transition validation:
     ```typescript
     class AgentStateMachine {
       private static readonly TRANSITIONS = {
         [AgentState.IDLE]: [AgentState.THINKING],
         [AgentState.THINKING]: [AgentState.ACTING, AgentState.ERROR],
         [AgentState.ACTING]: [AgentState.WAITING, AgentState.COMPLETED, AgentState.ERROR],
         [AgentState.WAITING]: [AgentState.ACTING, AgentState.IDLE],
         [AgentState.COMPLETED]: [AgentState.IDLE],
         [AgentState.ERROR]: [AgentState.IDLE]
       };
       
       transition(to: AgentState): void {
         const allowed = AgentStateMachine.TRANSITIONS[this.currentState];
         if (!allowed.includes(to)) {
           throw new InvalidStateTransitionError(`Cannot transition from ${this.currentState} to ${to}`);
         }
         this.currentState = to;
       }
     }
     ```
  3. Add state persistence to AgentRepository:
     ```typescript
     interface IAgentRepository {
       saveState(agentId: AgentId, state: AgentState): Promise<void>;
       getState(agentId: AgentId): Promise<AgentState>;
     }
     ```
  4. Emit state change events:
     ```typescript
     this.eventEmitter.emit('state_changed', this.id, previousState, newState);
     ```
- **Tests**:
  - Unit tests for all valid transitions
  - Test invalid transitions throw errors
  - Test state persistence and recovery
  - Integration test: agent recovers from ERROR state
- **Demo**: Show agent state transitions in Virtual Office with real-time UI updates

---

**Task 10: Implement Domain Event System**

> **2026-10-26:** `ApiUsageService` now raises `BudgetExceededEvent` when LLM cost crosses the budget, so `BudgetExceededHandler` pauses the running workflow.
- **Objective**: Decouple domain logic with event-driven communication
- **Implementation**:
  1. Create event base class:
     ```typescript
     abstract class DomainEvent {
       readonly occurredOn: Date = new Date();
       readonly eventId: string = uuid();
       abstract readonly eventType: string;
     }
     ```
  2. Define domain events:
     ```typescript
     class AgentCompletedTaskEvent extends DomainEvent {
       readonly eventType = 'agent.task.completed';
       constructor(
         readonly agentId: AgentId,
         readonly taskId: TaskId,
         readonly result: ActionResult
       ) { super(); }
     }
     
     class BudgetExceededEvent extends DomainEvent {
       readonly eventType = 'project.budget.exceeded';
       constructor(readonly projectId: ProjectId, readonly amount: Money) { super(); }
     }
     
     class WorkflowStateChangedEvent extends DomainEvent { ... }
     class MilestoneCompletedEvent extends DomainEvent { ... }
     ```
  3. Implement EventBus (Singleton):
     ```typescript
     @Injectable()
     class EventBus {
       private handlers = new Map<string, IEventHandler[]>();
       
       subscribe(eventType: string, handler: IEventHandler): void {
         const handlers = this.handlers.get(eventType) || [];
         handlers.push(handler);
         this.handlers.set(eventType, handlers);
       }
       
       async publish(event: DomainEvent): Promise<void> {
         const handlers = this.handlers.get(event.eventType) || [];
         await Promise.all(handlers.map(h => h.handle(event)));
       }
     }
     ```
  4. Create event handlers:
     ```typescript
     @Injectable()
     class BudgetExceededHandler implements IEventHandler<BudgetExceededEvent> {
       async handle(event: BudgetExceededEvent): Promise<void> {
         // Pause project workflow
         await this.workflowEngine.pauseWorkflow(event.projectId);
         // Send notification
         await this.notificationService.sendBudgetAlert(event.projectId, event.amount);
       }
     }
     ```
  5. Integrate with entities:
     ```typescript
     class Project {
       accrueCost(cost: Money): void {
         this.costAccrued = this.costAccrued.add(cost);
         if (this.costAccrued.greaterThan(this.budget)) {
           DomainEvents.raise(new BudgetExceededEvent(this.id, this.costAccrued));
         }
       }
     }
     ```
- **Tests**:
  - Unit tests for event handlers with mocked dependencies
  - Integration tests: emit event → verify handler invoked → verify side effects
  - Test event ordering and idempotency
- **Demo**: Show budget exceeded event triggering automatic workflow pause

---

### **Phase 2.5: OOAD Project Automation (Week 2-3)**

> **Key Insight:** Phase 1-2 refactored the AI-CORP platform itself. Phase 2.5 makes AI-CORP **automatically generate OOAD documentation for every client project it creates** — use cases, domain models, sequence diagrams, patterns, and traceability matrices are produced as first-class project artifacts.

---

**Task 10.1: Create OOAD Templates & Schema Validation**
- **Objective**: Define canonical templates and JSON schemas for all 5 mandatory OOAD artifacts so every agent produces structured, machine-readable output.
- **Implementation**:
  1. Create template directory: `apps/api/src/modules/agents/templates/ooad/`
  2. Add `use-case-template.md` with fields: ID, Name, Actor, Priority, Pre-conditions, Post-conditions, Main Flow, Alternative Flows, Exception Flows.
  3. Add `domain-model-template.puml` with PlantUML scaffold for entities, value objects, aggregates, and relationships.
  4. Add `architecture-patterns-template.md` with sections for architecture style, layer structure, and per-pattern fields (name, type, justification, location, benefit).
  5. Create Zod schemas in `apps/api/src/modules/agents/schemas/ooad.schema.ts`:
     ```typescript
     import { z } from 'zod';

     export const UseCaseSchema = z.object({
       actors: z.array(z.string()).min(1),
       useCases: z.array(z.object({
         id: z.string().regex(/^UC-\d{3}$/),
         name: z.string(),
         actor: z.string(),
         priority: z.enum(['High', 'Medium', 'Low']),
         preConditions: z.array(z.string()).min(1),
         postConditions: z.array(z.string()).min(1),
         mainFlow: z.array(z.string()).min(5),
         alternativeFlows: z.array(z.string()).min(1),
         exceptionFlows: z.array(z.string()).min(1)
       })).min(5)
     });

     export const DomainModelSchema = z.object({
       entities: z.array(z.object({
         name: z.string(),
         idType: z.string(),
         attributes: z.array(z.object({ name: z.string(), type: z.string() })),
         methods: z.array(z.object({ name: z.string(), params: z.string(), returnType: z.string() }))
       })).min(3),
       valueObjects: z.array(z.object({
         name: z.string(),
         attributes: z.array(z.object({ name: z.string(), type: z.string() }))
       })),
       aggregates: z.array(z.object({ root: z.string(), children: z.array(z.string()) })),
       relationships: z.array(z.object({
         from: z.string(), to: z.string(), type: z.string(), label: z.string().optional()
       }))
     });

     export const PatternsSchema = z.object({
       patterns: z.array(z.object({
         name: z.string(),
         type: z.enum(['Creational', 'Structural', 'Behavioral', 'Enterprise']),
         justification: z.string(),
         location: z.string(),
         benefit: z.string()
       })).min(3).max(5)
     });
     ```
  6. Add `ooadMetadata Json?` field to the `Project` model in `apps/api/prisma/schema.prisma` and generate a new Prisma migration.
- **Tests**:
  - Unit tests: validate each Zod schema with valid and invalid inputs
  - Verify template files render correctly with sample data
- **Demo**: Show schema validation catching an incomplete use case (missing `mainFlow`) and rejecting it with a typed error.

---

**Task 10.2: Refactor BA Agent for Structured OOAD Output**
- **Objective**: Update `BAActionStrategy` to generate structured use cases and a PlantUML use case diagram as mandatory project artifacts.
- **Implementation**:
  1. Update `apps/api/src/modules/agents/strategies/BAActionStrategy.ts`:
     - Load `use-case-template.md` from templates directory
     - Build structured LLM prompt requesting JSON output matching `UseCaseSchema`
     - Set `response_format: { type: 'json_object' }` on LLM call
     - Validate response against `UseCaseSchema` (throw `OOADSchemaValidationError` on failure)
     - Generate PlantUML use case diagram from parsed actors + use cases:
       ```typescript
       private generateUseCaseDiagram(data: UseCaseData): string {
         let puml = '@startuml\ntitle Use Cases\n\n';
         data.actors.forEach(actor => {
           puml += `actor "${actor}" as ${actor.replace(/\s/g, '')}\n`;
         });
         puml += '\n';
         data.useCases.forEach(uc => {
           const ucId = uc.id.replace('-', '');
           puml += `usecase "${uc.name}" as ${ucId}\n`;
           puml += `${uc.actor.replace(/\s/g, '')} --> ${ucId}\n`;
         });
         puml += '@enduml';
         return puml;
       }
       ```
     - Write `projects/{projectId}/docs/use-cases.md` (rendered from template)
     - Write `projects/{projectId}/docs/use-case-diagram.puml`
     - Persist `ooadMetadata.actors` and `ooadMetadata.useCases` to DB via `projectRepository.updateMetadata`
- **Tests**:
  - Mock LLM returning valid JSON → verify both files written to sandbox
  - Mock LLM returning invalid JSON → verify `OOADSchemaValidationError` thrown, no files written
  - Verify `ooadMetadata` persisted to DB after successful run
- **Demo**: Trigger BA Agent on sample project "Build an e-commerce platform". Show `projects/1/docs/use-cases.md` with 8 structured use cases and `use-case-diagram.puml` rendered in a PlantUML viewer.

---

**Task 10.3: Refactor Architect Agent for Domain Model & Pattern Selection**
- **Objective**: Update `ArchitectActionStrategy` to produce a domain model class diagram, layered architecture definition, and design pattern list with justifications — driven by BA's use case output.
- **Implementation**:
  1. Update `apps/api/src/modules/agents/strategies/ArchitectActionStrategy.ts`:
     - Load `ooadMetadata.useCases` from DB (written by BA Agent)
     - Run three sequential LLM calls with JSON output:
       - **Domain model**: extract entities, value objects, aggregates, relationships; validate with `DomainModelSchema`
       - **Patterns**: select 3-5 patterns with justifications; validate with `PatternsSchema`
       - **Architecture**: define layer structure with responsibilities and dependencies
     - Generate PlantUML class diagram:
       ```typescript
       private generateDomainModelPuml(model: DomainModel): string {
         let puml = '@startuml\ntitle Domain Model\n\n';
         model.entities.forEach(entity => {
           puml += `class ${entity.name} <<Entity>> {\n`;
           puml += `  - id: ${entity.idType}\n`;
           entity.attributes.forEach(attr => {
             puml += `  - ${attr.name}: ${attr.type}\n`;
           });
           puml += '  --\n';
           entity.methods.forEach(m => {
             puml += `  + ${m.name}(${m.params}): ${m.returnType}\n`;
           });
           puml += '}\n\n';
         });
         model.relationships.forEach(rel => {
           puml += `${rel.from} ${rel.type} ${rel.to}`;
           if (rel.label) puml += ` : ${rel.label}`;
           puml += '\n';
         });
         puml += '@enduml';
         return puml;
       }
       ```
     - Generate sequence diagrams for the top-3 High-priority use cases
     - Write artifacts: `domain-model.puml`, `architecture-patterns.md`, `sequence-{ucId}.puml` files
     - Persist `ooadMetadata.domainModel`, `ooadMetadata.patterns`, `ooadMetadata.architecture` to DB
- **Tests**:
  - Given sample use cases, LLM mock returns valid domain model → verify correct PlantUML generated
  - Patterns schema validation catches missing `justification` field
  - Integration: full Architect run on seeded project → all 4 artifact files exist in sandbox
- **Demo**: Show domain model PlantUML for e-commerce project with Order, Customer, Product entities. Show `architecture-patterns.md` listing "Repository Pattern" with justification: "Abstracts Prisma from domain layer, enabling unit-testable domain logic".

---

**Task 10.4: Add OOAD Quality Gate to Workflow**

> **2026-10-26:** the handler existed but was never wired. Now implemented as node type `quality_gate` (`QualityGateStrategy`, self-registered with the engine), node id `ooad_gate` between `design` and `breakdown` in `default-workflow.ts`; required artifacts are checked in `ProjectWorkspace`; results are stored in `QualityGateLog`. The gate is owned by QA (process role).
- **Objective**: Insert a `quality_gate` node between the Architect step and PM step in the default workflow DAG. Gate blocks progress until all 5 OOAD artifacts exist and minimum counts are met; on failure it loops back to the Architect.
- **Implementation**:
  1. Add `quality_gate` node to the default workflow in `apps/api/src/modules/workflow/workflow-definitions.ts`:
     ```typescript
     { 
       id: 'ooad_review_gate',
       type: 'quality_gate',
       reviewerRole: 'CEO',
       criteria: {
         minUseCases: 5,
         minEntities: 3,
         minPatterns: 3,
         requiredArtifacts: ['use-cases.md', 'domain-model.puml', 'architecture-patterns.md']
       },
       onFail: 'architect_design'
     },
     ```
  2. Add edges: `architect_design → ooad_review_gate → pm_breakdown` (if passed); `ooad_review_gate → architect_design` (if failed).
  3. Implement `QualityGateHandler` in `apps/api/src/modules/workflow/handlers/QualityGateHandler.ts`:
     - Check use case count, entity count, pattern count from `ooadMetadata`
     - Check each required artifact file exists in sandbox
     - Emit `quality_gate_result` WebSocket event with full checklist
     - Persist `gateResults` entry to `ooadMetadata` in DB
     - Return `{ passed: boolean, checklist: ChecklistItem[], nextNode: string | null }`
  4. Register handler in workflow engine node-handler registry.
- **Tests**:
  - All criteria met → `passed: true`, next node is `pm_breakdown`
  - Missing `use-cases.md` → `passed: false`, next node loops to `architect_design`
  - Entity count < 3 → checklist shows failing item
  - WebSocket event emitted with correct shape
- **Demo**: Run workflow on incomplete OOAD (2 use cases). Show gate failing with checklist. Fix BA output. Show gate passing and workflow advancing to PM step.

---

**Task 10.5: Update DEV Agent to Consume OOAD Artifacts**

> **2026-10-26:** DEV builds its design context from `ooadMetadata` (via `OOADArtifactService.buildImplementationContext`) and writes code to `ProjectWorkspace`; the gate guarantees the design exists before DEV runs.
- **Objective**: Inject OOAD design artifacts (use cases, domain model, architecture) into DEV Agent context so every implementation follows the approved design.
- **Implementation**:
  1. Update `apps/api/src/modules/agents/strategies/DevActionStrategy.ts`:
     ```typescript
     async act(thought: AgentThought, context: AgentContext): Promise<AgentActionResult> {
       const projectPath = `projects/${context.projectId}/docs`;
       const [useCases, domainModel, architecture] = await Promise.all([
         this.sandboxExecutor.readFile(`${projectPath}/use-cases.md`),
         this.sandboxExecutor.readFile(`${projectPath}/domain-model.puml`),
         this.sandboxExecutor.readFile(`${projectPath}/architecture-patterns.md`)
       ]);

       const enhancedPrompt = `
     TASK: ${context.taskDescription}

     YOU MUST FOLLOW THIS DESIGN:

     ==== USE CASES ====
     ${useCases}

     ==== DOMAIN MODEL ====
     ${domainModel}

     ==== ARCHITECTURE & PATTERNS ====
     ${architecture}

     IMPLEMENTATION RULES:
     1. Follow the layered architecture (domain/application/infrastructure).
     2. Implement entities exactly as in the domain model.
     3. Apply the design patterns listed above.
     4. Each class must reference its corresponding use case ID in a comment.
     5. Follow SOLID principles.

     Generate code for: ${context.taskDescription}
     `;
       // LLM call, code block extraction, file writing to projects/{projectId}/src/
     }
     ```
  2. If any artifact file is missing, throw `OOADGateNotPassedError` rather than proceeding without design context.
  3. Write generated files under `projects/{projectId}/src/` mirroring the layer structure from the architecture document.
- **Tests**:
  - All 3 artifacts present → enhanced prompt sent, code files written correctly
  - Missing `domain-model.puml` → `OOADGateNotPassedError` thrown
  - Generated code files placed under correct layer directories
- **Demo**: Show DEV Agent prompt containing the full domain model. Show generated `Order.ts` with `// UC-001: Create Order` comment at correct path `src/domain/entities/Order.ts`.

---

**Task 10.6: Add Traceability Matrix Generation (QC Agent)**

> **2026-10-26:** moved from QA to the new QC agent (`QcActionStrategy` + `TraceabilityService`). Files are read from `ProjectWorkspace`, not the sandbox; QC also writes the acceptance tests the matrix needs.
- **Objective**: Update `QaActionStrategy` to cross-reference use cases, domain entities, and test files into a traceability matrix, and alert when coverage drops below 80%.
- **Implementation**:
  1. Update `apps/api/src/modules/agents/strategies/QaActionStrategy.ts`:
     - Parse use case IDs and names from `projects/{projectId}/docs/use-cases.md`
     - Extract entity names from `projects/{projectId}/docs/domain-model.puml` via regex
     - Scan `projects/{projectId}/src/**/*.test.ts` for `describe`/`it` blocks referencing UC IDs
     - Build `TraceabilityRow[]` with fields: `useCaseId`, `useCaseName`, `domainClasses`, `testCases`, `coverage: 'Covered' | 'Missing'`
     - Render markdown table and write to `projects/{projectId}/docs/traceability-matrix.md`
     - Compute `coveragePercent`; if < 80%, emit `quality_alert` WebSocket event listing missing UC IDs
     - Persist `ooadMetadata.testCoveragePercent` to DB
- **Tests**:
  - 10 use cases, 8 with matching tests → coverage 80%, no alert emitted
  - 10 use cases, 5 with matching tests → coverage 50%, alert emitted with correct missing UC IDs
  - Traceability markdown table contains correct rows, totals, and coverage percentage
- **Demo**: Show `traceability-matrix.md` for e-commerce project with 12/15 use cases covered (80%). Show WebSocket alert listing the 3 missing test UC IDs.

---

**Task 10.7: Add OOAD Metrics Dashboard**

> **2026-10-26:** route fixed to `/api/ooad-metrics/...` (it was double-prefixed as `/api/api/ooad-metrics`). Coverage is read from `ooadMetadata.testCoverage`, written by QC.
- **Objective**: Expose API endpoints and an aggregate dashboard for OOAD quality metrics across all projects — usable directly as thesis evidence.
- **Implementation**:
  1. Create `apps/api/src/modules/ooad/ooad-metrics.service.ts`:
     ```typescript
     @Injectable()
     export class OOADMetricsService {
       async getProjectMetrics(projectId: string): Promise<OOADProjectMetrics> {
         const metadata = await this.projectRepository.findById(projectId);
         return {
           projectId,
           useCaseCount: metadata.ooadMetadata?.useCases?.length ?? 0,
           entityCount: metadata.ooadMetadata?.domainModel?.entities?.length ?? 0,
           patternCount: metadata.ooadMetadata?.patterns?.length ?? 0,
           testCoveragePercent: metadata.ooadMetadata?.testCoveragePercent ?? 0,
           qualityGatesPassed: metadata.ooadMetadata?.gateResults?.filter(g => g.passed).length ?? 0,
           qualityGatesFailed: metadata.ooadMetadata?.gateResults?.filter(g => !g.passed).length ?? 0
         };
       }

       async getDashboard(): Promise<OOADDashboard> {
         const projects = await this.projectRepository.findAll();
         const metrics = await Promise.all(projects.map(p => this.getProjectMetrics(p.id)));
         const avg = (arr: number[]) =>
           arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
         return {
           totalProjects: metrics.length,
           averageUseCases: avg(metrics.map(m => m.useCaseCount)),
           averageEntities: avg(metrics.map(m => m.entityCount)),
           averagePatterns: avg(metrics.map(m => m.patternCount)),
           averageTestCoverage: avg(metrics.map(m => m.testCoveragePercent)),
           qualityGatePassRate:
             (metrics.filter(m => m.qualityGatesPassed > m.qualityGatesFailed).length /
               metrics.length * 100).toFixed(1) + '%',
           projects: metrics
         };
       }
     }
     ```
  2. Create `apps/api/src/modules/ooad/ooad-metrics.controller.ts`:
     - `GET /api/ooad-metrics/dashboard` → aggregate dashboard
     - `GET /api/ooad-metrics/project/:projectId` → single project metrics
  3. Register `OOADMetricsModule` in `apps/api/src/app.module.ts`.
- **Tests**:
  - `getDashboard()` with 3 seeded projects → correct averages returned
  - `GET /api/ooad-metrics/dashboard` → 200 with expected JSON shape
  - `GET /api/ooad-metrics/project/nonexistent` → 404
- **Demo**: Call `GET /api/ooad-metrics/dashboard`. Show JSON with `totalProjects`, `averageTestCoverage`, and `qualityGatePassRate`. Present as direct evidence in thesis report.

---

### **Phase 3: Agent System Enhancement (Week 3-4)**

> **Re-scoped on 2026-10-26.** The original Tasks 11–13 (BA, Architect, DevOps agents) are obsolete: BA and Architect were delivered with structured OOAD output in Phase 2.5, and DevOps was removed (see *Agent role review*). Phase 3 now makes the agent system itself clean OOAD (open for new roles, one agent contract), makes QC's verification real, exposes the generated projects, and then adds learning and collaboration on that base. Task numbers 11–15 are kept so later phases' references stay valid.

**Phase 3 entry checklist (all done in the 2026-10-26 audit)**
- [x] API boots; all 8 agents run through injected strategies
- [x] Every agent LLM call is cost-tracked (`AgentLLMService` → `UsageTrackingLLMProvider`)
- [x] Generated projects persist in `ProjectWorkspace` (`PROJECTS_WORKSPACE_DIR`, default `apps/api/workspace/`)
- [x] OOAD quality gate wired; workflow CEO → BA → Architect → gate → PM → DEV → QC → QA → Marketing → approval → CEO
- [x] QC agent + traceability; QA re-focused on design conformance
- [x] Baseline green: `nest build`, Jest 21/21, web `tsc`; end-to-end run verified with a mock LLM

**Environment notes for Phase 3 work**: the repo has no lockfile and pins `pnpm@8.0.0` (fails on Node 22): install with `npx -y pnpm@8.15.9 install --no-frozen-lockfile`, then `npx prisma generate` in `apps/api` and `npx tsc -p packages/shared-types` (delete a stale `packages/shared-types/tsconfig.tsbuildinfo` first if `nest build` reports TS6305).

---

**Task 11: Agent Registry & Uniform Agent Contract** — ✅ Done (2026-10-26)
- **Objective**: Adding a role must not require editing the orchestrator, the module and the base class (OCP), and every agent must follow one contract.
- **Implementation**:
  1. Introduce an `AGENTS` multi-provider token; each agent class declares its `role`. `AgentOrchestratorService` builds its `Map<AgentRole, IAgent>` from the injected array instead of 8 constructor parameters:
     ```typescript
     { provide: AGENTS, useFactory: (...agents: BaseAgent[]) => agents, inject: [CeoAgent, BaAgent, /* ... */] }
     ```
  2. Introduce a `RoleProfile` value object (role, display name, system prompt, default `ModelRouteConfig`, memory namespaces) so the per-role defaults that are now repeated in agent classes, strategies and `seed.ts` live in one place (`agents/profiles/*.ts`). Seed reads the same profiles.
  3. Slim `BaseAgent`: remove the legacy abstract `think()/act()` fallback path and the unused `llmFactory`, `toolRegistry`, `apiUsageService` constructor arguments (they now live in strategies / `AgentLLMService`). `execute()` keeps the Template Method + State Machine flow.
  4. Make `AgentContext.taskType` drive strategy behaviour (as the CEO already does) and type `AgentActionResult.output` per role (`BaOutput`, `QcOutput`, ...) instead of `unknown`.
  5. Delete the duplicate `domain/agent/strategies/ThinkingStrategy.ts` classes and port their spec to the module strategies.
  6. Refresh the Phase 1 design docs that still show DevOps and the old QA-only flow: `docs/design/*.md`, class diagrams (`agent-aggregate`, `domain-model-overview`, `patterns-factory`, `patterns-strategy`), `AD-001`, `AD-002`, `component-diagram`, `package-diagram`, `SD-003`, `SD-004` (use case docs, use case diagrams and the requirements traceability matrix were already updated on 2026-10-26).
- **Tests**:
  - Orchestrator resolves all 8 roles from the token; unknown role error lists available roles
  - Adding a fake `TestAgent` via the token works without touching orchestrator code
  - `BaseAgent.execute()` state transitions (IDLE→THINKING→ACTING→COMPLETED→IDLE, ERROR path) with mocked strategies
  - Unit tests for each action strategy with a mocked `AgentLLMService` (prompt contains design context, output shape)
- **Demo**: Show the class diagram before/after: orchestrator depends on `IAgent[]`, not on 8 concrete classes.
- **Result (2026-10-26)**:
  1. `agents/agents.registry.ts`: `AGENTS` token, `AGENT_CLASSES` (the only list of concrete agents) and `agentsProvider()`; `AgentOrchestratorService` takes `@Inject(AGENTS) agents: IAgent[]` and rejects duplicate roles.
  2. `agents/profiles/`: `RoleProfile` value object (role, display name, system prompt, default model, memory namespaces, task types) and one profile per role. Strategies get model + persona from `AgentLLMService.providerFor(profile)`; thinking strategies recall `profile.primaryNamespace`; `prisma/seed.ts` builds the Agent rows from `ROLE_PROFILES`. Side fix: QA used to read `testing_patterns` but write `review_checklist`, so it never recalled its own memories.
  3. `BaseAgent<TOutput>` implements `IAgent` with constructor `(profile, thinkingStrategy, actionStrategy, websocketGateway, eventBus)`; the abstract `think()/act()`, `callLLM`, `executeTool`, `loadMemory/saveMemory` and the `memoryService/llmFactory/toolRegistry/sandboxExecutor/apiUsageService` arguments are gone. Concrete agents are 15-line classes. Observers now also receive `thinkingCompleted` / `actionCompleted`.
  4. `BaseAgent` resolves `context.taskType` against the profile (unknown → role default, logged). `AgentActionResult<TOutput>` / `IActionStrategy<TOutput>` are generic; outputs are typed in `domain/agent/AgentOutputs.ts` (`CeoOutput`, `BaOutput`, ..., `QcOutput`).
  5. `domain/agent/strategies/` and its spec deleted; replaced by specs for the module strategies.
  6. Diagrams refreshed: `agent-aggregate`, `domain-model-overview`, `patterns-factory` (registry before/after), `patterns-strategy`, `AD-001`, `AD-002`, `SD-003`, `SD-004`, `component-diagram`, `package-diagram`; `docs/design/*.md` and the traceability matrix (FR-AGENT-013 added, status summary recounted).
  - **Verification**: `nest build` 0 errors; Jest 24/24 suites, 374 tests (new: `role-profile`, `agent-registry` incl. a 9th `TestAgent`, `base-agent`, `agent-strategies` for all 16 strategies); the API boots and resolves `AgentsModule`/`OrchestratorModule` through the token.

---

**Task 12: Executable QC Verification**
- **Objective**: QC runs the generated acceptance tests, so traceability reports *passing* use cases, not just *existing* tests.
- **Implementation**:
  1. Extend the Architect skeleton with `package.json`, `tsconfig.json` and `jest.config.js` templates for the generated project.
  2. Add `SandboxExecutor.runInWorkspace(projectId, command, limits)`: mounts `projects/<id>` **read-only** at `/workspace` plus a tmpfs for `node_modules`/output, network disabled except for an optional package-registry allowlist; returns stdout and the Jest JSON report.
  3. `QcActionStrategy`: after writing tests, run `npx jest --json`; map results by `UC-xxx` in test names; traceability coverage becomes `Passing | Failing | Missing`; persist pass/fail counts to `ooadMetadata.traceability`.
  4. `qc_passed` requires coverage ≥ 80% **and** no failing High-priority use case; QA's prompt receives the failing tests.
  5. Optional: add a `qc_condition` so failing tests loop back to DEV before QA.
- **Tests**:
  - Workspace mount is read-only and confined to the project folder
  - Jest JSON → per-use-case status mapping
  - Coverage/`qc_passed` rules (all pass, one High failing, missing tests)
- **Demo**: Break `OrderService.placeOrder`, rerun: traceability shows UC-001 *Failing*, QA rejects, DEV fixes, QC passes.

---

**Task 13: Generated Project Artifacts API & UI**
- **Objective**: Make every artifact the agents produce visible — this is the thesis evidence for "OOAD applied to every project the agents create".
- **Implementation**:
  1. `ProjectArtifactsController`: `GET /api/projects/:id/files` (tree), `GET /api/projects/:id/files/*path` (content), `GET /api/projects/:id/archive` (zip download); reads through `ProjectWorkspace` only.
  2. Web: *Artifacts* tab in Project Detail — file tree, Markdown rendering for `use-cases.md` / `architecture-patterns.md` / `traceability-matrix.md`, PlantUML rendering (PlantUML server or `plantuml-encoder` + image) for `*.puml`, code viewer for `src/**`.
  3. Show `quality_gate_result` (checklist) and `quality_warning` WebSocket events in Project Detail / Virtual Office (they are emitted today but not rendered).
  4. Show `ooadMetadata` summary (use cases, entities, patterns, coverage) from `/api/ooad-metrics/project/:id`.
- **Tests**:
  - Controller rejects traversal (`../`), unknown project → 404, auth required
  - Zip contains docs/, src/, tests/
  - Web component tests for the file tree and gate checklist
- **Demo**: Open a finished project: browse use case diagram, class diagram, generated code, tests and the traceability matrix; download the zip.

---

**Task 14: Agent Learning & Memory Refinement**
- **Objective**: Agents improve from past executions, using the quality signals the workflow now produces.
- **Implementation**:
  1. `AgentLearningHandler` (subscribes to `AgentCompletedTaskEvent`) stores an execution memory per agent with the outcome signal: gate result for BA/Architect, QC coverage for DEV, QA verdict for DEV/QC.
  2. `MemoryService.refineMemory(role, namespace)` every N executions: LLM summarises successes vs failures into a high-importance `lessons_learned` memory (via `AgentLLMService`, so it is costed).
  3. Thinking strategies load `lessons_learned` alongside their namespace memories and pass them to the action prompt (they already pass `thought.memories`).
  4. Fallback when `OPENAI_API_KEY` is missing: keyword/recency search instead of returning nothing, so learning works in local demos.
  5. Agent Detail page: success rate over time, top lessons.
- **Tests**:
  - Refinement triggers on the N-th execution only
  - Lessons appear in the next prompt (mock LLM captures prompt)
  - Keyword fallback returns memories without embeddings
- **Demo**: Run the same project type 3 times; show the Architect's gate failures decrease and the lessons it learned.

---

**Task 15: Agent Collaboration Patterns**
- **Objective**: Model agent collaboration explicitly (Mediator + collaboration strategies) instead of only sequential hand-offs.
- **Implementation**:
  1. `AgentMessageBus` (Mediator) with FIPA-ACL performatives (REQUEST, INFORM, PROPOSE, ACCEPT, REJECT) replacing ad-hoc `AgentMessage` text; messages persisted and streamed to the Meeting Room.
  2. `agent_collaboration` node type + `CollaborationStrategy` registry (registers like `QualityGateStrategy`):
     - **Pair design/implementation**: Architect (navigator) reviews DEV's plan before code is written, then reviews the diff
     - **Review chain**: QC → QA as a Chain of Responsibility (already sequential in the workflow; formalise it so more reviewers can be added)
     - **Clarification loop**: DEV/QC can send a REQUEST to BA when a use case is ambiguous; BA answers with INFORM and updates the use case
  3. Default workflow option to replace `develop` with a `pair_develop` collaboration node.
- **Tests**:
  - Each collaboration strategy with mocked agents (message order, final output)
  - Message bus delivers, persists and validates performatives
- **Demo**: Meeting Room transcript of Architect ↔ DEV pairing, and a BA clarification answered mid-run.

---

**Phase 3 Definition of Done**
- Adding a 9th role touches only its profile, strategies and one provider entry
- QC coverage is based on executed tests; QA decisions reference real failures
- Every generated project can be browsed and downloaded from the UI
- `nest build`, Jest (new specs for every task) and web `tsc` stay green; one end-to-end run documented with screenshots for the thesis

---

### **Phase 4: Workflow Engine Enhancement (Week 4-5)**

---

**Task 16: Implement Sub-Workflows & Workflow Composition**
- **Objective**: Support hierarchical workflows with reusable sub-workflows
- **Implementation**:
  1. Extend WorkflowNode to support sub-workflows:
     ```typescript
     interface WorkflowNode {
       id: string;
       type: 'agent_task' | 'human_approval' | 'condition' | 'parallel' | 'sub_workflow'; // NEW
       subWorkflowId?: string; // NEW
       // ... other fields
     }
     ```
  2. Implement CompositeWorkflow pattern:
     ```typescript
     class CompositeWorkflow implements IWorkflow {
       constructor(
         private readonly definition: WorkflowDefinition,
         private readonly subWorkflows: Map<string, IWorkflow>
       ) {}
       
       async execute(context: WorkflowContext): Promise<WorkflowResult> {
         for (const node of this.definition.nodes) {
           if (node.type === 'sub_workflow') {
             const subWorkflow = this.subWorkflows.get(node.subWorkflowId);
             const subResult = await subWorkflow.execute(context);
             // Merge sub-workflow result into context
             context.variables = { ...context.variables, ...subResult.output };
           } else {
             // Execute node normally
             await this.executeNode(node, context);
           }
         }
       }
     }
     ```
  3. Create reusable sub-workflow templates:
     ```typescript
     const codeReviewSubWorkflow: WorkflowDefinition = {
       id: 'code_review_sub',
       name: 'Code Review Sub-Workflow',
       nodes: [
         { id: 'dev_implement', type: 'agent_task', agentRole: 'DEV' },
         { id: 'qa_review', type: 'agent_task', agentRole: 'QA' },
         { id: 'qa_condition', type: 'condition', conditions: { onSuccess: 'end', onFail: 'dev_implement' } },
         { id: 'end', type: 'end' }
       ],
       edges: [...]
     };
     ```
  4. Update WorkflowEngine to handle sub-workflows:
     ```typescript
     private async executeSubWorkflow(node: WorkflowNode, run: WorkflowRun): Promise<NodeResult> {
       const subWorkflowDef = this.definitions.get(node.subWorkflowId);
       const subWorkflowRun = await this.startWorkflow(run.projectId, node.subWorkflowId, run.context);
       // Wait for sub-workflow completion
       await this.waitForCompletion(subWorkflowRun.id);
       // Retrieve sub-workflow result
       const completedRun = await this.prisma.workflowRun.findUnique({ where: { id: subWorkflowRun.id } });
       return { status: 'success', output: completedRun.context.variables };
     }
     ```
  5. Add sub-workflow UI visualization:
     - Nested workflow diagram with expand/collapse
     - Breadcrumb navigation through workflow hierarchy
- **Tests**:
  - Unit test: Sub-workflow execution
  - Integration test: Parent workflow invokes sub-workflow and receives result
  - Test sub-workflow context isolation
  - Test recursive sub-workflows (workflow calls itself)
- **Demo**: Create project with sub-workflow → Show nested execution in Virtual Office

---

**Task 17: Implement Workflow Versioning & Rollback**
- **Objective**: Support workflow versions with ability to rollback to previous state
- **Implementation**:
  1. Add version tracking to WorkflowDefinition:
     ```typescript
     interface WorkflowDefinition {
       id: string;
       version: string; // Semantic versioning: "1.0.0"
       name: string;
       // ... other fields
     }
     ```
  2. Implement Memento pattern for workflow state:
     ```typescript
     class WorkflowSnapshot {
       constructor(
         readonly runId: string,
         readonly nodeId: string,
         readonly context: WorkflowContext,
         readonly timestamp: Date
       ) {}
     }
     
     class WorkflowSnapshotManager {
       private snapshots = new Map<string, WorkflowSnapshot[]>();
       
       createSnapshot(run: WorkflowRun): void {
         const snapshot = new WorkflowSnapshot(run.id, run.currentNodeId, run.context, new Date());
         const snapshots = this.snapshots.get(run.id) || [];
         snapshots.push(snapshot);
         this.snapshots.set(run.id, snapshots);
       }
       
       rollback(runId: string, steps: number = 1): WorkflowSnapshot {
         const snapshots = this.snapshots.get(runId) || [];
         if (snapshots.length < steps + 1) throw new Error('Not enough snapshots');
         return snapshots[snapshots.length - steps - 1];
       }
     }
     ```
  3. Integrate snapshot creation into WorkflowEngine:
     ```typescript
     private async executeNode(node: WorkflowNode, run: WorkflowRun): Promise<NodeResult> {
       // Create snapshot before executing node
       this.snapshotManager.createSnapshot(run);
       
       const result = await this.executeNodeByType(node, run);
       
       // If failed and rollback enabled
       if (result.status === 'failure' && node.allowRollback) {
         const snapshot = this.snapshotManager.rollback(run.id, 1);
         await this.restoreSnapshot(run.id, snapshot);
       }
       
       return result;
     }
     ```
  4. Add rollback API endpoint:
     ```typescript
     @Post('/workflows/:runId/rollback')
     async rollbackWorkflow(@Param('runId') runId: string, @Body() dto: RollbackDto) {
       const snapshot = this.snapshotManager.rollback(runId, dto.steps);
       await this.workflowEngine.restoreSnapshot(runId, snapshot);
       return { message: `Rolled back ${dto.steps} steps`, currentNodeId: snapshot.nodeId };
     }
     ```
  5. Store snapshots in database for persistence:
     ```prisma
     model WorkflowSnapshot {
       id            String    @id @default(uuid())
       workflowRunId String
       nodeId        String
       context       Json
       createdAt     DateTime  @default(now())
       
       workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id])
       @@index([workflowRunId, createdAt])
     }
     ```
- **Tests**:
  - Unit test: Snapshot creation and retrieval
  - Integration test: Rollback workflow to previous node
  - Test rollback with modified context
  - Test snapshot persistence across server restarts
- **Demo**: Execute workflow → Trigger error → Show rollback to previous node

---

**Task 18: Implement Parallel Execution Optimization**
- **Objective**: Optimize parallel node execution with dependency resolution
- **Implementation**:
  1. Enhance parallel node with dependency specification:
     ```typescript
     interface ParallelNode extends WorkflowNode {
       type: 'parallel';
       parallelBranches: {
         nodeId: string;
         dependencies?: string[]; // Node IDs that must complete first
       }[];
       concurrencyLimit?: number; // Max concurrent executions
     }
     ```
  2. Implement topological sort for dependency resolution:
     ```typescript
     class DependencyResolver {
       resolveDependencies(branches: ParallelBranch[]): string[][] {
         // Build adjacency list
         const graph = new Map<string, string[]>();
         const inDegree = new Map<string, number>();
         
         for (const branch of branches) {
           inDegree.set(branch.nodeId, branch.dependencies?.length || 0);
           for (const dep of branch.dependencies || []) {
             const edges = graph.get(dep) || [];
             edges.push(branch.nodeId);
             graph.set(dep, edges);
           }
         }
         
         // Topological sort (Kahn's algorithm)
         const layers: string[][] = [];
         const queue = branches.filter(b => (b.dependencies?.length || 0) === 0).map(b => b.nodeId);
         
         while (queue.length > 0) {
           const currentLayer = [...queue];
           layers.push(currentLayer);
           queue.length = 0;
           
           for (const nodeId of currentLayer) {
             for (const dependent of graph.get(nodeId) || []) {
               inDegree.set(dependent, inDegree.get(dependent)! - 1);
               if (inDegree.get(dependent) === 0) queue.push(dependent);
             }
           }
         }
         
         return layers;
       }
     }
     ```
  3. Implement parallel execution with concurrency control:
     ```typescript
     private async executeParallel(node: ParallelNode, run: WorkflowRun): Promise<NodeResult> {
       const resolver = new DependencyResolver();
       const layers = resolver.resolveDependencies(node.parallelBranches);
       const results = new Map<string, NodeResult>();
       
       // Execute layer by layer
       for (const layer of layers) {
         const limit = node.concurrencyLimit || Infinity;
         const batches = this.createBatches(layer, limit);
         
         for (const batch of batches) {
           const promises = batch.map(nodeId => {
             const branchNode = this.getNodeById(nodeId, run);
             return this.executeNode(branchNode, run);
           });
           
           const batchResults = await Promise.all(promises);
           batch.forEach((nodeId, i) => results.set(nodeId, batchResults[i]));
         }
       }
       
       // Check if all branches succeeded
       const allSucceeded = Array.from(results.values()).every(r => r.status === 'success');
       return { status: allSucceeded ? 'success' : 'failure', output: Object.fromEntries(results) };
     }
     ```
  4. Add parallel execution visualization:
     - Gantt chart showing parallel execution timeline
     - Dependency graph visualization
- **Tests**:
  - Unit test: Dependency resolution (topological sort)
  - Test cyclic dependency detection
  - Integration test: Parallel execution with dependencies completes correctly
  - Performance test: Parallel execution is faster than sequential
- **Demo**: Show workflow with parallel branches → Display execution timeline in UI

---

**Task 19: Implement Workflow Templates & Reusable Patterns**
- **Objective**: Create library of workflow templates for common scenarios
- **Implementation**:
  1. Define workflow template schema:
     ```typescript
     interface WorkflowTemplate {
       id: string;
       name: string;
       description: string;
       category: 'software_development' | 'data_analysis' | 'marketing' | 'custom';
       parameters: WorkflowParameter[];
       definition: WorkflowDefinition;
     }
     
     interface WorkflowParameter {
       name: string;
       type: 'string' | 'number' | 'boolean' | 'array';
       description: string;
       defaultValue?: any;
       required: boolean;
     }
     ```
  2. Create template library:
     ```typescript
     const templates: WorkflowTemplate[] = [
       {
         id: 'full_stack_web_app',
         name: 'Full Stack Web Application',
         description: 'Complete workflow for building full-stack web apps',
         category: 'software_development',
         parameters: [
           { name: 'tech_stack', type: 'string', description: 'Technology stack (e.g., MERN, PERN)', required: true },
           { name: 'has_auth', type: 'boolean', description: 'Include authentication', defaultValue: true, required: false }
         ],
         definition: { /* Workflow with BA → Architect → OOAD gate → DEV → QC → QA */ }
       },
       {
         id: 'api_only',
         name: 'REST API Backend',
         description: 'Workflow for building REST API backend',
         category: 'software_development',
         parameters: [
           { name: 'database', type: 'string', description: 'Database type (PostgreSQL, MongoDB)', required: true }
         ],
         definition: { /* Workflow with BA → Architect → DEV → QC → QA */ }
       },
       {
         id: 'ml_pipeline',
         name: 'ML Model Training Pipeline',
         description: 'Workflow for training and deploying ML models',
         category: 'data_analysis',
         parameters: [
           { name: 'model_type', type: 'string', description: 'Model type (classification, regression)', required: true }
         ],
         definition: { /* Workflow with BA → DataScientist → MLEngineer → QC */ }
       }
     ];
     ```
  3. Implement template instantiation:
     ```typescript
     class WorkflowTemplateService {
       instantiateTemplate(templateId: string, params: Record<string, any>): WorkflowDefinition {
         const template = this.templates.find(t => t.id === templateId);
         if (!template) throw new Error('Template not found');
         
         // Validate parameters
         this.validateParameters(template.parameters, params);
         
         // Replace placeholders in definition
         const definition = this.replacePlaceholders(template.definition, params);
         
         return definition;
       }
       
       private replacePlaceholders(definition: WorkflowDefinition, params: Record<string, any>): WorkflowDefinition {
         // Deep clone and replace ${param_name} with actual values
         const json = JSON.stringify(definition);
         const replaced = json.replace(/\$\{(\w+)\}/g, (match, paramName) => {
           return params[paramName] || match;
         });
         return JSON.parse(replaced);
       }
     }
     ```
  4. Add template selection UI:
     - Template gallery with preview
     - Parameter form
     - Workflow visualization before creation
  5. Store templates in database:
     ```prisma
     model WorkflowTemplate {
       id          String   @id @default(uuid())
       name        String
       description String
       category    String
       parameters  Json
       definition  Json
       isPublic    Boolean  @default(true)
       createdBy   String?
       createdAt   DateTime @default(now())
     }
     ```
- **Tests**:
  - Unit test: Template instantiation with parameters
  - Test parameter validation
  - Integration test: Create project from template
  - Test custom template creation by users
- **Demo**: Select template → Fill parameters → Show instantiated workflow → Execute

---

### **Phase 5: Enterprise Features & Security (Week 5-6)**

---

**Task 20: Implement Role-Based Access Control (RBAC)**
- **Objective**: Granular permissions for users and agents
- **Implementation**:
  1. Define permission system:
     ```typescript
     enum Permission {
       PROJECT_CREATE = 'project:create',
       PROJECT_READ = 'project:read',
       PROJECT_UPDATE = 'project:update',
       PROJECT_DELETE = 'project:delete',
       WORKFLOW_START = 'workflow:start',
       WORKFLOW_PAUSE = 'workflow:pause',
       APPROVAL_GRANT = 'approval:grant',
       AGENT_CONFIGURE = 'agent:configure',
       AUDIT_VIEW = 'audit:view'
     }
     
     enum Role {
       ADMIN = 'admin',
       BOARD_MEMBER = 'board_member',
       VIEWER = 'viewer',
       AGENT = 'agent'
     }
     
     const RolePermissions: Record<Role, Permission[]> = {
       [Role.ADMIN]: [/* all permissions */],
       [Role.BOARD_MEMBER]: [Permission.PROJECT_CREATE, Permission.PROJECT_READ, Permission.APPROVAL_GRANT, Permission.WORKFLOW_PAUSE],
       [Role.VIEWER]: [Permission.PROJECT_READ],
       [Role.AGENT]: [Permission.PROJECT_READ, Permission.WORKFLOW_START]
     };
     ```
  2. Implement authorization service:
     ```typescript
     @Injectable()
     class AuthorizationService {
       hasPermission(user: User, permission: Permission): boolean {
         const userPermissions = RolePermissions[user.role];
         return userPermissions.includes(permission);
       }
       
       async checkPermission(user: User, permission: Permission): Promise<void> {
         if (!this.hasPermission(user, permission)) {
           throw new ForbiddenException(`User lacks permission: ${permission}`);
         }
       }
     }
     ```
  3. Create authorization guard:
     ```typescript
     @Injectable()
     export class PermissionGuard implements CanActivate {
       constructor(private readonly authService: AuthorizationService, private readonly reflector: Reflector) {}
       
       canActivate(context: ExecutionContext): boolean {
         const requiredPermission = this.reflector.get<Permission>('permission', context.getHandler());
         if (!requiredPermission) return true;
         
         const request = context.switchToHttp().getRequest();
         const user = request.user;
         
         return this.authService.hasPermission(user, requiredPermission);
       }
     }
     ```
  4. Apply to controllers:
     ```typescript
     @Controller('projects')
     export class ProjectsController {
       @Post()
       @RequirePermission(Permission.PROJECT_CREATE)
       @UseGuards(JwtAuthGuard, PermissionGuard)
       async createProject(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
         return this.projectsService.create(dto, user.id);
       }
       
       @Delete(':id')
       @RequirePermission(Permission.PROJECT_DELETE)
       @UseGuards(JwtAuthGuard, PermissionGuard)
       async deleteProject(@Param('id') id: string) {
         return this.projectsService.delete(id);
       }
     }
     ```
  5. Add permission management UI:
     - Role management page
     - User assignment to roles
     - Permission matrix view
- **Tests**:
  - Unit test: Permission checking logic
  - Integration test: Guard blocks unauthorized requests
  - E2E test: User with VIEWER role cannot create projects
- **Demo**: Login as different roles → Show different UI capabilities based on permissions

---

**Task 21: Implement Comprehensive Audit Logging**
- **Objective**: Track all user and system actions for compliance
- **Implementation**:
  1. Define audit log schema:
     ```prisma
     model AuditLog {
       id            String   @id @default(uuid())
       timestamp     DateTime @default(now())
       userId        String?
       agentRole     String?
       action        String   // "project.create", "workflow.start", "approval.grant"
       resourceType  String   // "Project", "Workflow", "Task"
       resourceId    String?
       changes       Json?    // Before/after state
       ipAddress     String?
       userAgent     String?
       success       Boolean  @default(true)
       errorMessage  String?
       
       @@index([timestamp])
       @@index([userId, timestamp])
       @@index([action, timestamp])
     }
     ```
  2. Implement audit logger:
     ```typescript
     @Injectable()
     class AuditLogService {
       async log(entry: AuditLogEntry): Promise<void> {
         await this.prisma.auditLog.create({ data: entry });
       }
       
       async logAction(
         user: User | null,
         action: string,
         resourceType: string,
         resourceId: string,
         changes?: any,
         request?: Request
       ): Promise<void> {
         await this.log({
           userId: user?.id,
           action,
           resourceType,
           resourceId,
           changes,
           ipAddress: request?.ip,
           userAgent: request?.headers['user-agent'],
           success: true
         });
       }
       
       async logError(
         user: User | null,
         action: string,
         error: Error,
         request?: Request
       ): Promise<void> {
         await this.log({
           userId: user?.id,
           action,
           success: false,
           errorMessage: error.message,
           ipAddress: request?.ip,
           userAgent: request?.headers['user-agent']
         });
       }
     }
     ```
  3. Create audit interceptor:
     ```typescript
     @Injectable()
     export class AuditInterceptor implements NestInterceptor {
       constructor(private readonly auditService: AuditLogService) {}
       
       intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
         const request = context.switchToHttp().getRequest();
         const user = request.user;
         const action = `${request.method} ${request.url}`;
         
         return next.handle().pipe(
           tap(() => {
             this.auditService.logAction(user, action, 'HTTP', request.url, null, request);
           }),
           catchError(error => {
             this.auditService.logError(user, action, error, request);
             throw error;
           })
         );
       }
     }
     ```
  4. Apply to sensitive operations:
     ```typescript
     @Post()
     @UseInterceptors(AuditInterceptor)
     async createProject(@Body() dto: CreateProjectDto, @CurrentUser() user: User, @Req() request: Request) {
       const project = await this.projectsService.create(dto, user.id);
       await this.auditService.logAction(user, 'project.create', 'Project', project.id, { dto }, request);
       return project;
     }
     ```
  5. Add audit log UI:
     - Filterable table by user, action, date range
     - Export to CSV for compliance reports
     - Anomaly detection (e.g., unusual access patterns)
- **Tests**:
  - Unit test: Audit log creation
  - Integration test: Action creates audit log entry
  - Test audit log query filtering
  - Test anomaly detection (e.g., many failed login attempts)
- **Demo**: Perform actions → Show audit log with before/after state → Export CSV

---

**Task 22: Implement Integration APIs**
- **Objective**: Enable external tools to integrate with AI-CORP
- **Implementation**:
  1. Design RESTful integration API:
     ```typescript
     @Controller('api/v1/integrations')
     @UseGuards(ApiKeyAuthGuard)
     export class IntegrationController {
       @Post('/projects')
       async createProject(@Body() dto: CreateProjectApiDto) {
         return this.projectsService.create(dto);
       }
       
       @Get('/projects/:id/status')
       async getProjectStatus(@Param('id') id: string) {
         return this.projectsService.getStatus(id);
       }
       
       @Post('/projects/:id/webhooks')
       async registerWebhook(@Param('id') projectId: string, @Body() dto: WebhookDto) {
         return this.webhookService.register(projectId, dto.url, dto.events);
       }
     }
     ```
  2. Implement API key authentication:
     ```typescript
     @Injectable()
     export class ApiKeyAuthGuard implements CanActivate {
       canActivate(context: ExecutionContext): boolean {
         const request = context.switchToHttp().getRequest();
         const apiKey = request.headers['x-api-key'];
         
         if (!apiKey) return false;
         
         const valid = this.apiKeyService.validate(apiKey);
         if (valid) {
           request.user = this.apiKeyService.getUserByApiKey(apiKey);
         }
         return valid;
       }
     }
     ```
  3. Implement webhook system:
     ```typescript
     @Injectable()
     class WebhookService {
       async register(projectId: string, url: string, events: string[]): Promise<Webhook> {
         return this.prisma.webhook.create({
           data: { projectId, url, events }
         });
       }
       
       async trigger(event: string, projectId: string, payload: any): Promise<void> {
         const webhooks = await this.prisma.webhook.findMany({
           where: { projectId, events: { has: event } }
         });
         
         await Promise.all(webhooks.map(webhook =>
           this.httpService.post(webhook.url, { event, payload }).toPromise()
         ));
       }
     }
     
     @Injectable()
     class WebhookEventHandler implements IEventHandler<ProjectCompletedEvent> {
       async handle(event: ProjectCompletedEvent): Promise<void> {
         await this.webhookService.trigger('project.completed', event.projectId, event);
       }
     }
     ```
  4. Create OpenAPI documentation:
     ```typescript
     const config = new DocumentBuilder()
       .setTitle('AI-CORP Integration API')
       .setDescription('API for integrating external tools with AI-CORP')
       .setVersion('1.0')
       .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
       .build();
     const document = SwaggerModule.createDocument(app, config);
     SwaggerModule.setup('api/docs', app, document);
     ```
  5. Add rate limiting:
     ```typescript
     @Injectable()
     export class RateLimitGuard implements CanActivate {
       private readonly limiter = new Map<string, { count: number; resetAt: number }>();
       
       canActivate(context: ExecutionContext): boolean {
         const request = context.switchToHttp().getRequest();
         const apiKey = request.headers['x-api-key'];
         
         const limit = this.limiter.get(apiKey) || { count: 0, resetAt: Date.now() + 60000 };
         if (Date.now() > limit.resetAt) {
           limit.count = 0;
           limit.resetAt = Date.now() + 60000;
         }
         
         if (limit.count >= 100) { // 100 requests per minute
           throw new TooManyRequestsException();
         }
         
         limit.count++;
         this.limiter.set(apiKey, limit);
         return true;
       }
     }
     ```
- **Tests**:
  - Unit test: API key validation
  - Integration test: Webhook triggered on event
  - Test rate limiting enforcement
  - Test OpenAPI spec generation
- **Demo**: Register webhook → Trigger event → Show webhook received payload

---

**Task 23: Implement Data Export & Reporting**
- **Objective**: Export project data and generate reports
- **Implementation**:
  1. Implement export service:
     ```typescript
     @Injectable()
     class ExportService {
       async exportProject(projectId: string, format: 'json' | 'csv' | 'pdf'): Promise<Buffer> {
         const project = await this.projectsService.getFullProject(projectId);
         
         switch (format) {
           case 'json':
             return Buffer.from(JSON.stringify(project, null, 2));
           case 'csv':
             return this.exportToCsv(project);
           case 'pdf':
             return this.exportToPdf(project);
         }
       }
       
       private exportToCsv(project: Project): Buffer {
         const csv = [
           ['Task ID', 'Title', 'Status', 'Assigned Agent', 'Cost'],
           ...project.tasks.map(t => [t.id, t.title, t.status, t.assignedAgent, t.actualCost])
         ].map(row => row.join(',')).join('\n');
         return Buffer.from(csv);
       }
       
       private async exportToPdf(project: Project): Promise<Buffer> {
         const PDFDocument = require('pdfkit');
         const doc = new PDFDocument();
         const chunks: Buffer[] = [];
         
         doc.on('data', (chunk) => chunks.push(chunk));
         doc.on('end', () => {});
         
         doc.fontSize(20).text(`Project: ${project.name}`, { align: 'center' });
         doc.moveDown();
         doc.fontSize(12).text(`Status: ${project.status}`);
         doc.text(`Budget: $${project.budget}`);
         doc.text(`Cost Accrued: $${project.costAccrued}`);
         doc.moveDown();
         doc.fontSize(14).text('Tasks:');
         project.tasks.forEach(task => {
           doc.fontSize(10).text(`- ${task.title} (${task.status})`);
         });
         
         doc.end();
         return Buffer.concat(chunks);
       }
     }
     ```
  2. Implement report generation:
     ```typescript
     @Injectable()
     class ReportService {
       async generateCostReport(projectId: string): Promise<CostReport> {
         const logs = await this.prisma.apiUsageLog.findMany({ where: { projectId } });
         
         const byAgent = logs.reduce((acc, log) => {
           acc[log.agentRole] = (acc[log.agentRole] || 0) + parseFloat(log.actualCost.toString());
           return acc;
         }, {} as Record<string, number>);
         
         const byModel = logs.reduce((acc, log) => {
           acc[log.actualModelUsed] = (acc[log.actualModelUsed] || 0) + parseFloat(log.actualCost.toString());
           return acc;
         }, {} as Record<string, number>);
         
         return { byAgent, byModel, total: logs.reduce((sum, l) => sum + parseFloat(l.actualCost.toString()), 0) };
       }
       
       async generatePerformanceReport(agentRole: AgentRole): Promise<PerformanceReport> {
         const steps = await this.prisma.workflowStep.findMany({
           where: { agentRole },
           select: { durationMs: true, status: true }
         });
         
         const successRate = steps.filter(s => s.status === 'completed').length / steps.length;
         const avgDuration = steps.reduce((sum, s) => sum + (s.durationMs || 0), 0) / steps.length;
         
         return { agentRole, successRate, avgDuration, totalExecutions: steps.length };
       }
     }
     ```
  3. Add export endpoints:
     ```typescript
     @Get('/projects/:id/export')
     @Header('Content-Type', 'application/octet-stream')
     async exportProject(
       @Param('id') id: string,
       @Query('format') format: 'json' | 'csv' | 'pdf'
     ): Promise<StreamableFile> {
       const buffer = await this.exportService.exportProject(id, format);
       return new StreamableFile(buffer);
     }
     
     @Get('/reports/cost/:projectId')
     async getCostReport(@Param('projectId') projectId: string) {
       return this.reportService.generateCostReport(projectId);
     }
     ```
  4. Add scheduled reports:
     ```typescript
     @Injectable()
     class ScheduledReportService {
       @Cron('0 0 * * MON') // Every Monday at midnight
       async sendWeeklyReport() {
         const projects = await this.prisma.project.findMany({ where: { status: 'active' } });
         for (const project of projects) {
           const report = await this.reportService.generateCostReport(project.id);
           await this.emailService.send(project.createdBy.email, 'Weekly Cost Report', report);
         }
       }
     }
     ```
- **Tests**:
  - Unit test: CSV/PDF generation
  - Integration test: Export endpoint returns valid file
  - Test report accuracy with sample data
  - Test scheduled report execution
- **Demo**: Export project as PDF → Show formatted report with charts

---

### **Phase 6: AI/ML Features & Testing (Week 6-7)**

---

**Task 24: Implement Agent Performance Analytics**
- **Objective**: Track and visualize agent performance metrics
- **Implementation**:
  1. Define performance metrics:
     ```typescript
     interface AgentPerformanceMetrics {
       agentRole: AgentRole;
       period: { start: Date; end: Date };
       executionCount: number;
       successRate: number;
       averageDuration: number;
       costEfficiency: number; // Success per dollar
       qualityScore: number; // Based on QA feedback
       learningVelocity: number; // Improvement rate over time
     }
     ```
  2. Implement metrics calculator:
     ```typescript
     @Injectable()
     class AgentMetricsService {
       async calculateMetrics(agentRole: AgentRole, start: Date, end: Date): Promise<AgentPerformanceMetrics> {
         const steps = await this.prisma.workflowStep.findMany({
           where: {
             agentRole,
             startedAt: { gte: start, lte: end }
           }
         });
         
         const executionCount = steps.length;
         const successRate = steps.filter(s => s.status === 'completed').length / executionCount;
         const averageDuration = steps.reduce((sum, s) => sum + (s.durationMs || 0), 0) / executionCount;
         
         const costs = await this.prisma.apiUsageLog.aggregate({
           where: {
             agentRole,
             createdAt: { gte: start, lte: end }
           },
           _sum: { actualCost: true }
         });
         const totalCost = parseFloat(costs._sum.actualCost?.toString() || '0');
         const costEfficiency = successRate / (totalCost || 1);
         
         const qualityScore = await this.calculateQualityScore(agentRole, start, end);
         const learningVelocity = await this.calculateLearningVelocity(agentRole);
         
         return {
           agentRole,
           period: { start, end },
           executionCount,
           successRate,
           averageDuration,
           costEfficiency,
           qualityScore,
           learningVelocity
         };
       }
       
       private async calculateQualityScore(agentRole: AgentRole, start: Date, end: Date): Promise<number> {
         // For DEV agent: count code reviews that passed without revisions
         if (agentRole === 'DEV') {
           const reviews = await this.prisma.workflowStep.findMany({
             where: {
               agentRole: 'QA',
               startedAt: { gte: start, lte: end },
               output: { path: ['qa_approved'], equals: true }
             }
           });
           return reviews.length / (reviews.length + 1); // Smoothing
         }
         // Default: success rate
         return this.calculateMetrics(agentRole, start, end).then(m => m.successRate);
       }
       
       private async calculateLearningVelocity(agentRole: AgentRole): Promise<number> {
         // Calculate rate of improvement: (recent success rate - past success rate) / time
         const now = new Date();
         const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
         const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
         
         const recentMetrics = await this.calculateMetrics(agentRole, oneWeekAgo, now);
         const pastMetrics = await this.calculateMetrics(agentRole, twoWeeksAgo, oneWeekAgo);
         
         return (recentMetrics.successRate - pastMetrics.successRate) / 7; // Per day
       }
     }
     ```
  3. Create analytics dashboard:
     - Line chart: Success rate over time
     - Bar chart: Cost efficiency comparison across agents
     - Heatmap: Agent activity by day/hour
     - Leaderboard: Top performing agents
  4. Implement anomaly detection:
     ```typescript
     @Injectable()
     class AnomalyDetectionService {
       async detectAnomalies(agentRole: AgentRole): Promise<Anomaly[]> {
         const metrics = await this.agentMetricsService.calculateMetrics(
           agentRole,
           new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
           new Date()
         );
         
         const anomalies: Anomaly[] = [];
         
         // Check for sudden performance drop
         if (metrics.learningVelocity < -0.05) {
           anomalies.push({
             type: 'performance_degradation',
             agent: agentRole,
             severity: 'high',
             message: `${agentRole} agent performance degrading at ${metrics.learningVelocity.toFixed(3)}/day`
           });
         }
         
         // Check for unusual cost spike
         if (metrics.costEfficiency < 0.1) {
           anomalies.push({
             type: 'cost_inefficiency',
             agent: agentRole,
             severity: 'medium',
             message: `${agentRole} agent cost efficiency below threshold`
           });
         }
         
         return anomalies;
       }
     }
     ```
- **Tests**:
  - Unit test: Metrics calculation with sample data
  - Test learning velocity calculation
  - Integration test: Anomaly detection triggers alert
  - Test dashboard data aggregation
- **Demo**: Show analytics dashboard → Trigger performance drop → Display anomaly alert

---

**Task 25: Implement Task Estimation ML Model**
- **Objective**: Predict task duration and cost using historical data
- **Implementation**:
  1. Collect training data:
     ```typescript
     interface TaskTrainingData {
       features: {
         taskComplexity: number; // 1-10 scale
         descriptionLength: number;
         agentRole: string;
         projectDomain: string;
         dependencyCount: number;
         estimatedLines: number;
       };
       labels: {
         actualDuration: number; // milliseconds
         actualCost: number; // dollars
       };
     }
     
     @Injectable()
     class TrainingDataCollector {
       async collectData(): Promise<TaskTrainingData[]> {
         const completedTasks = await this.prisma.task.findMany({
           where: { status: 'done' },
           include: { workflowSteps: true, project: true }
         });
         
         return completedTasks.map(task => {
           const step = task.workflowSteps[0];
           return {
             features: {
               taskComplexity: this.estimateComplexity(task.description),
               descriptionLength: task.description.length,
               agentRole: task.assignedAgent || 'DEV',
               projectDomain: this.inferDomain(task.project.description),
               dependencyCount: this.countDependencies(task),
               estimatedLines: this.estimateLines(task.description)
             },
             labels: {
               actualDuration: step.durationMs || 0,
               actualCost: parseFloat(task.actualCost.toString())
             }
           };
         });
       }
     }
     ```
  2. Train ML model (using TensorFlow.js or Python service):
     ```typescript
     import * as tf from '@tensorflow/tfjs-node';
     
     @Injectable()
     class TaskEstimationModel {
       private model: tf.Sequential;
       
       async train(data: TaskTrainingData[]): Promise<void> {
         // Prepare tensors
         const xs = tf.tensor2d(data.map(d => [
           d.features.taskComplexity,
           d.features.descriptionLength / 100, // Normalize
           this.encodeAgent(d.features.agentRole),
           this.encodeDomain(d.features.projectDomain),
           d.features.dependencyCount,
           d.features.estimatedLines / 10
         ]));
         
         const ys = tf.tensor2d(data.map(d => [
           d.labels.actualDuration / 60000, // Convert to minutes
           d.labels.actualCost
         ]));
         
         // Build model
         this.model = tf.sequential({
           layers: [
             tf.layers.dense({ inputShape: [6], units: 64, activation: 'relu' }),
             tf.layers.dropout({ rate: 0.2 }),
             tf.layers.dense({ units: 32, activation: 'relu' }),
             tf.layers.dense({ units: 2, activation: 'linear' }) // Duration, Cost
           ]
         });
         
         this.model.compile({
           optimizer: tf.train.adam(0.001),
           loss: 'meanSquaredError',
           metrics: ['mae']
         });
         
         // Train
         await this.model.fit(xs, ys, {
           epochs: 100,
           validationSplit: 0.2,
           callbacks: {
             onEpochEnd: (epoch, logs) => {
               console.log(`Epoch ${epoch}: loss = ${logs.loss}`);
             }
           }
         });
         
         // Save model
         await this.model.save('file://./models/task-estimation');
       }
       
       async predict(features: TaskTrainingData['features']): Promise<{ duration: number; cost: number }> {
         const input = tf.tensor2d([[
           features.taskComplexity,
           features.descriptionLength / 100,
           this.encodeAgent(features.agentRole),
           this.encodeDomain(features.projectDomain),
           features.dependencyCount,
           features.estimatedLines / 10
         ]]);
         
         const prediction = this.model.predict(input) as tf.Tensor;
         const [duration, cost] = await prediction.data();
         
         return {
           duration: duration * 60000, // Convert back to milliseconds
           cost
         };
       }
     }
     ```
  3. Integrate predictions into workflow:
     ```typescript
     class PmAgent extends BaseAgent {
       async act(thought: ThinkingResult, context: AgentContext): Promise<ActionResult> {
         const tasks = this.parseTasks(thought.plan);
         
         // Predict duration and cost for each task
         for (const task of tasks) {
           const features = this.extractFeatures(task, context);
           const prediction = await this.estimationModel.predict(features);
           task.estimatedCost = prediction.cost;
           task.estimatedDuration = prediction.duration;
         }
         
         await this.taskRepository.createMany(tasks);
         return { success: true, output: tasks };
       }
     }
     ```
  4. Retrain model periodically:
     ```typescript
     @Injectable()
     class ModelRetrainingService {
       @Cron('0 0 * * SUN') // Every Sunday at midnight
       async retrainModel() {
         const data = await this.trainingDataCollector.collectData();
         if (data.length < 100) {
           this.logger.warn('Insufficient data for retraining');
           return;
         }
         await this.estimationModel.train(data);
         this.logger.log('Task estimation model retrained');
       }
     }
     ```
- **Tests**:
  - Unit test: Model training with synthetic data
  - Test prediction accuracy (MAE < 20% of actual)
  - Integration test: PM agent uses predictions
  - Test model retraining doesn't degrade performance
- **Demo**: Create task → Show ML prediction → Complete task → Compare actual vs predicted

---

**Task 26: Implement Code Quality Prediction**
- **Objective**: Predict code quality issues before QA review
- **Implementation**:
  1. Define quality metrics:
     ```typescript
     interface CodeQualityMetrics {
       complexity: number; // Cyclomatic complexity
       maintainability: number; // Maintainability index
       testCoverage: number; // Percentage
       lintErrors: number;
       securityVulnerabilities: number;
       overallScore: number; // 0-100
     }
     ```
  2. Implement static analysis:
     ```typescript
     @Injectable()
     class CodeAnalysisService {
       async analyzeCode(code: string, language: string): Promise<CodeQualityMetrics> {
         // Use ESLint for JavaScript/TypeScript
         if (language === 'typescript') {
           const linter = new ESLint({ baseConfig: { extends: ['eslint:recommended'] } });
           const results = await linter.lintText(code);
           const lintErrors = results[0].errorCount + results[0].warningCount;
           
           // Calculate complexity
           const complexity = this.calculateComplexity(code);
           const maintainability = this.calculateMaintainability(code, complexity);
           
           // Estimate test coverage (based on test file presence)
           const testCoverage = this.estimateTestCoverage(code);
           
           // Security scan (basic patterns)
           const securityVulnerabilities = this.scanSecurity(code);
           
           const overallScore = this.calculateOverallScore({
             complexity,
             maintainability,
             testCoverage,
             lintErrors,
             securityVulnerabilities
           });
           
           return {
             complexity,
             maintainability,
             testCoverage,
             lintErrors,
             securityVulnerabilities,
             overallScore
           };
         }
         
         // Default fallback
         return { complexity: 0, maintainability: 100, testCoverage: 0, lintErrors: 0, securityVulnerabilities: 0, overallScore: 50 };
       }
       
       private calculateComplexity(code: string): number {
         // Count control flow statements
         const controlFlowKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||'];
         let complexity = 1; // Base complexity
         for (const keyword of controlFlowKeywords) {
           const regex = new RegExp(`\\b${keyword}\\b`, 'g');
           const matches = code.match(regex);
           complexity += matches ? matches.length : 0;
         }
         return complexity;
       }
       
       private calculateMaintainability(code: string, complexity: number): number {
         const lines = code.split('\n').length;
         const commentLines = code.split('\n').filter(l => l.trim().startsWith('//')).length;
         const commentRatio = commentLines / lines;
         
         // Simplified maintainability index
         const mi = 171 - 5.2 * Math.log(lines) - 0.23 * complexity + 16.2 * Math.log(lines * commentRatio + 1);
         return Math.max(0, Math.min(100, mi));
       }
       
       private scanSecurity(code: string): number {
         const vulnerabilityPatterns = [
           /eval\(/g, // eval usage
           /innerHTML\s*=/g, // XSS risk
           /document\.write/g,
           /\.exec\(/g, // SQL injection risk
           /process\.env\./g // Exposed env vars
         ];
         
         let count = 0;
         for (const pattern of vulnerabilityPatterns) {
           const matches = code.match(pattern);
           count += matches ? matches.length : 0;
         }
         return count;
       }
     }
     ```
  3. Integrate into DEV agent:
     ```typescript
     class DEVActionStrategy implements IActionStrategy {
       async act(thought: ThinkingResult, context: AgentContext): Promise<ActionResult> {
         const code = thought.generatedCode;
         
         // Analyze code quality
         const qualityMetrics = await this.codeAnalysisService.analyzeCode(code, 'typescript');
         
         // If quality score is low, refine code
         if (qualityMetrics.overallScore < 70) {
           const refinementPrompt = `Improve this code (quality score: ${qualityMetrics.overallScore}):
                                     Issues: ${this.formatIssues(qualityMetrics)}
                                     Code: ${code}`;
           const refined = await this.llmProvider.chat({ messages: [{ role: 'user', content: refinementPrompt }] });
           const refinedMetrics = await this.codeAnalysisService.analyzeCode(refined.content, 'typescript');
           
           return {
             success: true,
             output: refined.content,
             qualityMetrics: refinedMetrics,
             improved: refinedMetrics.overallScore > qualityMetrics.overallScore
           };
         }
         
         return { success: true, output: code, qualityMetrics };
       }
     }
     ```
  4. Add quality prediction UI:
     - Display metrics in code editor
     - Highlight problematic lines
     - Suggest improvements
- **Tests**:
  - Unit test: Complexity calculation
  - Test maintainability scoring
  - Integration test: DEV agent refines low-quality code
  - Test security vulnerability detection
- **Demo**: DEV agent generates code → Show quality metrics → Auto-refine if score < 70

---

**Task 27: Comprehensive Unit & Integration Testing**
- **Objective**: Achieve 90%+ test coverage with TDD approach
- **Implementation**:
  1. Set up testing infrastructure:
     ```bash
     npm install --save-dev @nestjs/testing jest @types/jest ts-jest
     npm install --save-dev supertest @types/supertest
     npm install --save-dev @testing-library/react @testing-library/jest-dom
     ```
  2. Create test utilities:
     ```typescript
     // test/utils/test-module.builder.ts
     export class TestModuleBuilder {
       static async build(overrides: { providers?: Provider[] } = {}): Promise<TestingModule> {
         return Test.createTestingModule({
           providers: [
             { provide: PrismaService, useValue: mockPrismaService },
             { provide: EventBus, useValue: mockEventBus },
             ...overrides.providers || []
           ]
         }).compile();
       }
     }
     
     // test/utils/mock-factories.ts
     export const createMockAgent = (role: AgentRole): IAgent => ({
       getId: jest.fn().mockReturnValue('agent-123'),
       getRole: jest.fn().mockReturnValue(role),
       getState: jest.fn().mockReturnValue(AgentState.IDLE),
       execute: jest.fn().mockResolvedValue({ thought: {}, action: {} }),
       addEventListener: jest.fn(),
       removeEventListener: jest.fn()
     });
     ```
  3. Write unit tests for all entities:
     ```typescript
     // src/domain/entities/Project.spec.ts
     describe('Project Entity', () => {
       describe('create', () => {
         it('should create a valid project', () => {
           const project = Project.create('Test', 'Description', 'Goal', Money.dollars(100));
           expect(project.getName()).toBe('Test');
           expect(project.getStatus()).toBe(ProjectStatus.ACTIVE);
         });
         
         it('should throw error if name too short', () => {
           expect(() => Project.create('AB', 'Desc', 'Goal', Money.dollars(100)))
             .toThrow(ValidationError);
         });
       });
       
       describe('addMilestone', () => {
         it('should add milestone if project active', () => {
           const project = Project.create('Test', 'Desc', 'Goal', Money.dollars(100));
           const milestone = Milestone.create('M1', 'Milestone 1');
           
           project.addMilestone(milestone);
           
           expect(project.getMilestones()).toHaveLength(1);
         });
         
         it('should emit MilestoneAddedEvent', () => {
           const project = Project.create('Test', 'Desc', 'Goal', Money.dollars(100));
           const milestone = Milestone.create('M1', 'Milestone 1');
           const eventSpy = jest.spyOn(DomainEvents, 'raise');
           
           project.addMilestone(milestone);
           
           expect(eventSpy).toHaveBeenCalledWith(expect.any(MilestoneAddedEvent));
         });
         
         it('should throw error if project not active', () => {
           const project = Project.create('Test', 'Desc', 'Goal', Money.dollars(100));
           project.complete();
           const milestone = Milestone.create('M1', 'Milestone 1');
           
           expect(() => project.addMilestone(milestone)).toThrow(BusinessRuleViolation);
         });
       });
       
       describe('accrueCost', () => {
         it('should emit BudgetExceededEvent when over budget', () => {
           const project = Project.create('Test', 'Desc', 'Goal', Money.dollars(100));
           const eventSpy = jest.spyOn(DomainEvents, 'raise');
           
           project.accrueCost(Money.dollars(150));
           
           expect(eventSpy).toHaveBeenCalledWith(expect.any(BudgetExceededEvent));
         });
       });
     });
     ```
  4. Write integration tests:
     ```typescript
     // src/application/use-cases/CreateProject.integration.spec.ts
     describe('CreateProject Use Case (Integration)', () => {
       let app: INestApplication;
       let prisma: PrismaService;
       
       beforeAll(async () => {
         const module = await Test.createTestingModule({
           imports: [AppModule]
         }).compile();
         
         app = module.createNestApplication();
         await app.init();
         prisma = app.get(PrismaService);
       });
       
       afterAll(async () => {
         await app.close();
       });
       
       it('should create project and start workflow', async () => {
         const dto = { name: 'Test Project', description: 'Desc', goal: 'Goal', budget: 100 };
         
         const response = await request(app.getHttpServer())
           .post('/projects')
           .set('Authorization', `Bearer ${testToken}`)
           .send(dto)
           .expect(201);
         
         const project = await prisma.project.findUnique({ where: { id: response.body.id } });
         expect(project).toBeDefined();
         expect(project.name).toBe('Test Project');
         
         const workflowRun = await prisma.workflowRun.findFirst({ where: { projectId: project.id } });
         expect(workflowRun).toBeDefined();
         expect(workflowRun.status).toBe('running');
       });
     });
     ```
  5. Write E2E tests:
     ```typescript
     // test/e2e/project-lifecycle.e2e-spec.ts
     describe('Project Lifecycle (E2E)', () => {
       it('should complete full project workflow', async () => {
         // Create project
         const createResponse = await request(app.getHttpServer())
           .post('/projects')
           .send({ name: 'E2E Test', description: 'Desc', goal: 'Build API', budget: 50 })
           .expect(201);
         
         const projectId = createResponse.body.id;
         
         // Wait for workflow to complete (poll status)
         let project;
         for (let i = 0; i < 60; i++) {
           project = await prisma.project.findUnique({ where: { id: projectId } });
           if (project.status === 'completed') break;
           await new Promise(resolve => setTimeout(resolve, 1000));
         }
         
         expect(project.status).toBe('completed');
         
         // Verify tasks created
         const tasks = await prisma.task.findMany({ where: { projectId } });
         expect(tasks.length).toBeGreaterThan(0);
         
         // Verify cost tracked
         expect(parseFloat(project.costAccrued.toString())).toBeGreaterThan(0);
       });
     });
     ```
  6. Configure Jest for coverage:
     ```javascript
     // jest.config.js
     module.exports = {
       collectCoverageFrom: [
         'src/**/*.ts',
         '!src/**/*.spec.ts',
         '!src/main.ts',
         '!src/**/*.module.ts'
       ],
       coverageThreshold: {
         global: {
           branches: 90,
           functions: 90,
           lines: 90,
           statements: 90
         }
       }
     };
     ```
- **Tests**:
  - Run all tests: `npm test`
  - Coverage report: `npm run test:cov`
  - Verify 90%+ coverage across branches, functions, lines
- **Demo**: Run full test suite → Show coverage report → Demonstrate TDD workflow (write failing test → implement → test passes)

---

**Task 28: Performance & Load Testing**
- **Objective**: Ensure system scales under load
- **Implementation**:
  1. Set up performance testing tools:
     ```bash
     npm install --save-dev artillery @types/artillery
     npm install --save-dev clinic
     ```
  2. Create load test scenarios:
     ```yaml
     # test/performance/workflow-load.yml
     config:
       target: "http://localhost:3000"
       phases:
         - duration: 60
           arrivalRate: 10 # 10 new projects per second
         - duration: 120
           arrivalRate: 50 # Ramp up to 50/sec
       processor: "./test/performance/auth-processor.js"
     scenarios:
       - name: "Create and execute project"
         flow:
           - function: "authenticate"
           - post:
               url: "/projects"
               json:
                 name: "Load Test {{ $uuid }}"
                 description: "Performance test"
                 goal: "Build simple API"
                 budget: 50
               capture:
                 - json: "$.id"
                   as: "projectId"
           - think: 5
           - get:
               url: "/projects/{{ projectId }}"
           - think: 10
           - post:
               url: "/projects/{{ projectId }}/tasks"
               json:
                 title: "Task {{ $uuid }}"
                 description: "Load test task"
     ```
  3. Run performance tests:
     ```bash
     artillery run test/performance/workflow-load.yml --output report.json
     artillery report report.json
     ```
  4. Profile application with Clinic.js:
     ```bash
     clinic doctor -- node dist/main.js
     clinic flame -- node dist/main.js
     clinic bubbleprof -- node dist/main.js
     ```
  5. Implement performance optimizations:
     ```typescript
     // Add caching to expensive operations
     @Injectable()
     class CachedProjectService {
       constructor(
         private readonly projectService: ProjectService,
         private readonly cacheManager: Cache
       ) {}
       
       async getProject(id: string): Promise<Project> {
         const cached = await this.cacheManager.get<Project>(`project:${id}`);
         if (cached) return cached;
         
         const project = await this.projectService.getProject(id);
         await this.cacheManager.set(`project:${id}`, project, { ttl: 300 }); // 5 min TTL
         return project;
       }
     }
     
     // Optimize database queries
     const projects = await this.prisma.project.findMany({
       where: { status: 'active' },
       include: {
         milestones: { select: { id: true, name: true, status: true } }, // Select only needed fields
         tasks: { where: { status: 'in_progress' } }, // Filter at DB level
         _count: { select: { tasks: true } } // Use aggregation instead of loading all
       },
       take: 20, // Pagination
       skip: (page - 1) * 20
     });
     
     // Add database indexes
     // See schema.prisma @@index directives
     
     // Use BullMQ for async processing (already implemented in WorkflowEngine)
     ```
  6. Set performance budgets:
     ```typescript
     // test/performance/budgets.ts
     export const PERFORMANCE_BUDGETS = {
       apiResponseTime: {
         p50: 100, // ms
         p95: 500,
         p99: 1000
       },
       workflowNodeExecution: {
         p50: 2000,
         p95: 5000,
         p99: 10000
       },
       databaseQueries: {
         p50: 10,
         p95: 50,
         p99: 100
       }
     };
     ```
- **Tests**:
  - Load test: 1000 concurrent users creating projects
  - Stress test: Gradually increase load until failure point
  - Endurance test: Sustained load for 1 hour
  - Verify response times meet performance budgets
- **Demo**: Run load test → Show metrics dashboard (requests/sec, response times, error rate) → Display flame graph

---

### **Phase 7: Documentation & Demo Preparation (Week 7)**

---

**Task 29: Write IEEE-Format Thesis Documentation**
- **Objective**: Complete academic thesis document
- **Implementation**:
  1. **Abstract** (200-300 words):
     - Problem: Manual software development workflows lack automation and optimization
     - Solution: AI-CORP multi-agent platform with OOAD architecture
     - Methods: Applied SOLID principles, 20+ design patterns, domain-driven design
     - Results: 90%+ test coverage, <2s workflow node execution, extensible architecture
     - Conclusion: Demonstrates viability of AI-driven software development automation
  2. **Introduction** (4-5 pages):
     - Background on software development challenges
     - Motivation for multi-agent systems
     - Research questions:
       - RQ1: Can OOAD principles improve multi-agent system architecture?
       - RQ2: What design patterns are most effective for agent coordination?
       - RQ3: How can agents learn from past executions to improve performance?
     - Thesis contributions:
       - Comprehensive OOAD refactoring of multi-agent platform
       - Novel agent collaboration patterns
       - ML-based task estimation and code quality prediction
     - Document structure outline
  3. **Literature Review** (10-12 pages):
     - Section 2.1: Object-Oriented Analysis and Design
       - UML methodology (Booch, Rumbaugh, Jacobson)
       - SOLID principles (Martin, 2000)
       - Design patterns (Gang of Four, 1994; Fowler, 2002)
     - Section 2.2: Multi-Agent Systems
       - BDI architecture (Rao & Georgeff, 1995)
       - Agent communication (FIPA-ACL)
       - Agent coordination patterns
     - Section 2.3: Workflow Orchestration
       - BPMN 2.0 standard
       - Petri nets for process modeling
       - State machines for workflow control
     - Section 2.4: AI in Software Development
       - Code generation with LLMs
       - Automated testing and QA
       - Performance prediction models
     - Research gap: Lack of comprehensive OOAD application in multi-agent platforms
  4. **Methodology** (8-10 pages):
     - Section 3.1: System Architecture Design
       - Layered architecture with DDD
       - Domain, application, infrastructure layers
       - Dependency inversion and abstractions
     - Section 3.2: Design Pattern Selection
       - Table mapping patterns to problems
       - Rationale for each pattern choice
     - Section 3.3: Agent Design
       - Strategy pattern for thinking/acting
       - State machine for lifecycle management
       - Event-driven communication
     - Section 3.4: Workflow Engine Design
       - DAG-based orchestration
       - Parallel execution with dependency resolution
       - Memento pattern for rollback
     - Section 3.5: Testing Strategy
       - TDD approach
       - Unit, integration, E2E test layers
       - Performance and load testing
  5. **Implementation** (15-20 pages):
     - Section 4.1: Domain Layer Implementation
       - Entity design (Project, Agent, Workflow, Task)
       - Value objects (Money, AgentRole, TaskStatus)
       - Repository interfaces
     - Section 4.2: Design Pattern Implementation
       - Code examples for key patterns (Factory, Strategy, Observer, Repository)
       - UML diagrams for each pattern
     - Section 4.3: Agent System Implementation
       - BaseAgent refactoring
       - New agent roles (BA, Architect, QC) and the QA/QC split
       - Agent learning and memory system
     - Section 4.4: Workflow Engine Implementation
       - Sub-workflows and composition
       - Versioning and rollback
       - Parallel execution optimization
     - Section 4.5: Enterprise Features
       - RBAC implementation
       - Audit logging
       - Integration APIs
     - Section 4.6: AI/ML Features
       - Task estimation model architecture
       - Code quality prediction
       - Agent performance analytics
  6. **Results** (8-10 pages):
     - Section 5.1: Test Coverage Results
       - Table showing coverage metrics (90%+ achieved)
       - Comparison before/after refactoring
     - Section 5.2: Performance Benchmarks
       - Workflow node execution times (p50, p95, p99)
       - Load test results (max throughput, latency)
       - Resource utilization (CPU, memory)
     - Section 5.3: Code Quality Metrics
       - Cyclomatic complexity reduction
       - Maintainability index improvement
       - Code smell reduction
     - Section 5.4: Agent Performance
       - Success rate improvements with learning
       - Cost efficiency metrics
       - Quality score trends
     - Section 5.5: Case Studies
       - Case 1: Full-stack web app project
       - Case 2: REST API backend project
       - Case 3: ML pipeline project
  7. **Discussion** (5-7 pages):
     - RQ1 Answer: OOAD principles significantly improve modularity and testability
     - RQ2 Answer: Strategy, Repository, and Event-driven patterns most effective
     - RQ3 Answer: Agent learning shows 15% performance improvement over 10 executions
     - Limitations:
       - LLM quality dependency
       - Limited domain-specific knowledge
       - Computational cost of learning
     - Future work:
       - More sophisticated ML models
       - Human-agent collaboration patterns
       - Cross-project knowledge transfer
  8. **Conclusion** (2-3 pages):
     - Summary of contributions
     - Achievement of research objectives
     - Practical implications for industry
     - Academic contributions to multi-agent systems research
  9. **References** (50+ citations):
     - IEEE citation format
     - Include all cited works from literature review
  10. **Appendices**:
      - Appendix A: Complete UML diagrams
      - Appendix B: API documentation
      - Appendix C: Test coverage reports
      - Appendix D: Performance benchmark data
      - Appendix E: User guide
- **Tests**: N/A (documentation task)
- **Demo**: Present formatted thesis document (100-120 pages) following IEEE template

---

**Task 30: Create Comprehensive UML Diagrams**
- **Objective**: Generate all UML diagrams for thesis appendix
- **Implementation**:
  1. Use PlantUML for all diagrams:
     ```bash
     npm install -g node-plantuml
     ```
  2. Create use case diagrams:
     ```plantuml
     @startuml
     left to right direction
     actor "Board Member" as BM
     actor "Admin" as Admin
     actor "AI Agent" as Agent
     
     rectangle "AI-CORP System" {
       usecase "Create Project" as UC1
       usecase "Approve Workflow Step" as UC2
       usecase "View Analytics" as UC3
       usecase "Execute Task" as UC4
       usecase "Analyze Requirements" as UC5
       usecase "Design Architecture" as UC6
       usecase "Deploy Application" as UC7
       
       BM --> UC1
       BM --> UC2
       BM --> UC3
       Admin --> UC3
       Agent --> UC4
       Agent --> UC5
       Agent --> UC6
       Agent --> UC7
     }
     @enduml
     ```
  3. Create class diagrams:
     ```plantuml
     @startuml
     abstract class BaseAgent {
       - id: AgentId
       - role: AgentRole
       - stateMachine: AgentStateMachine
       + execute(context: AgentContext): Promise<AgentResult>
       # emitEvent(event: DomainEvent): void
     }
     
     interface IThinkingStrategy {
       + think(context: AgentContext): Promise<ThinkingResult>
     }
     
     interface IActionStrategy {
       + act(thought: ThinkingResult, context: AgentContext): Promise<ActionResult>
     }
     
     class CEOThinkingStrategy implements IThinkingStrategy
     class PMThinkingStrategy implements IThinkingStrategy
     class DEVThinkingStrategy implements IThinkingStrategy
     
     BaseAgent --> IThinkingStrategy : uses
     BaseAgent --> IActionStrategy : uses
     
     class Project {
       - id: ProjectId
       - name: string
       - status: ProjectStatus
       - budget: Money
       + addMilestone(milestone: Milestone): void
       + accrueCost(cost: Money): void
     }
     
     class Milestone {
       - id: MilestoneId
       - name: string
       - status: MilestoneStatus
       + complete(): void
     }
     
     Project "1" *-- "0..*" Milestone : contains
     @enduml
     ```
  4. Create sequence diagrams (already documented in Task 3)
  5. Create activity diagrams (already documented in Task 4)
  6. Create state machine diagrams (already documented in Task 4)
  7. Create component diagram:
     ```plantuml
     @startuml
     package "Presentation Layer" {
       component [REST Controllers]
       component [WebSocket Gateway]
     }
     
     package "Application Layer" {
       component [Use Case Services]
       component [Application Services]
       component [DTO Mappers]
     }
     
     package "Domain Layer" {
       component [Entities]
       component [Domain Services]
       component [Event Bus]
       component [Repository Interfaces]
     }
     
     package "Infrastructure Layer" {
       component [Prisma Repositories]
       component [LLM Adapters]
       component [Sandbox Executor]
     }
     
     [REST Controllers] --> [Use Case Services]
     [Use Case Services] --> [Domain Services]
     [Domain Services] --> [Repository Interfaces]
     [Prisma Repositories] ..|> [Repository Interfaces] : implements
     @enduml
     ```
  8. Create deployment diagram:
     ```plantuml
     @startuml
     node "Client Browser" {
       component [React Frontend]
     }
     
     node "API Server" {
       component [NestJS Backend]
       component [WorkflowEngine]
       component [AgentOrchestrator]
     }
     
     node "Database Server" {
       database [PostgreSQL]
     }
     
     node "Cache Server" {
       database [Redis]
     }
     
     node "LLM Gateway" {
       component [9Router]
     }
     
     node "Docker Host" {
       component [Code Sandbox]
     }
     
     [React Frontend] --> [NestJS Backend] : HTTPS
     [NestJS Backend] --> [PostgreSQL] : TCP/5432
     [NestJS Backend] --> [Redis] : TCP/6379
     [WorkflowEngine] --> [9Router] : HTTPS
     [AgentOrchestrator] --> [Code Sandbox] : Docker API
     @enduml
     ```
  9. Generate all diagrams:
     ```bash
     for file in docs/uml/*.puml; do
       node-plantuml "$file" -o docs/diagrams/
     done
     ```
- **Tests**: N/A (documentation task)
- **Demo**: Present diagram portfolio (30+ diagrams) with explanations

---

**Task 31: Prepare Demo Presentation**
- **Objective**: Create compelling demo for thesis defense
- **Implementation**:
  1. Create demo script:
     ```markdown
     # AI-CORP Demo Script (15 minutes)
     
     ## Introduction (1 min)
     - Project overview: Multi-agent platform for enterprise workflow automation
     - Key innovations: OOAD architecture, 20+ design patterns, agent learning
     
     ## Architecture Overview (2 min)
     - Show layered architecture diagram
     - Explain domain-driven design approach
     - Highlight SOLID principles application
     
     ## Live Demo Part 1: Project Creation (3 min)
     1. Login as board member
     2. Create new project: "E-commerce Platform"
     3. Show workflow visualization with new agents (BA, Architect, QC) and the OOAD quality gate
     4. Real-time Virtual Office showing agents thinking/acting
     5. Watch BA agent extract requirements
     6. Watch Architect agent design system
     
     ## Live Demo Part 2: Agent Collaboration (3 min)
     1. Show pair programming between DEV and Architect
     2. Display collaboration transcript in Meeting Room
     3. Show code quality metrics (complexity, maintainability)
     4. Watch QC agent write use-case tests and QA agent review design conformance
     5. Show auto-refinement when quality score low
     
     ## Live Demo Part 3: Enterprise Features (2 min)
     1. Show RBAC: login as viewer vs admin
     2. Display audit log of all actions
     3. Show cost analytics dashboard
     4. Display agent performance metrics
     5. Demonstrate workflow rollback
     
     ## Live Demo Part 4: AI/ML Features (2 min)
     1. Create new task → show ML prediction (duration, cost)
     2. Compare prediction vs actual after completion
     3. Show agent learning curve (success rate improvement)
     4. Display code quality prediction
     
     ## Results Summary (1 min)
     - Test coverage: 92%
     - Workflow execution: 1.8s average per node
     - Agent learning: 15% improvement over 10 executions
     - Load test: 50 projects/sec sustained throughput
     
     ## Q&A (1 min)
     ```
  2. Create presentation slides (PowerPoint/Google Slides):
     - Title slide
     - Problem statement slide
     - Solution overview slide
     - Architecture diagram slide
     - Key design patterns slide
     - Demo transition slides
     - Results summary slide
     - Conclusion slide
  3. Set up demo environment:
     - Clean database with seed data
     - Pre-configured projects at various stages
     - Mock LLM responses for consistent demo (optional)
     - Recording software (OBS Studio) for backup video
  4. Practice demo:
     - Rehearse full script 5+ times
     - Time each section
     - Prepare for common questions
     - Have fallback plan if live demo fails
  5. Create demo video (backup):
     - Record full demo walkthrough
     - Add voiceover narration
     - Edit with captions and highlights
     - Upload to YouTube (unlisted)
- **Tests**: N/A (presentation task)
- **Demo**: Full 15-minute live demo with Q&A

---

**Task 32: Final Integration & Deployment**
- **Objective**: Deploy production-ready system for demo
- **Implementation**:
  1. Environment configuration:
     ```bash
     # Production .env
     NODE_ENV=production
     DATABASE_URL=postgresql://user:pass@host:5432/ai-corp-prod
     REDIS_URL=redis://host:6379
     JWT_SECRET=<strong-secret>
     NINE_ROUTER_URL=https://api.opencode.ai/v1
     NINE_ROUTER_API_KEY=<api-key>
     LOG_LEVEL=info
     ENABLE_SWAGGER=false
     CORS_ORIGIN=https://ai-corp-demo.com
     ```
  2. Database migration:
     ```bash
     cd apps/api
     npx prisma migrate deploy
     npx prisma db seed
     ```
  3. Build and deploy:
     ```bash
     # Build
     pnpm build
     
     # Deploy to server (Docker Compose)
     docker-compose -f docker-compose.prod.yml up -d
     ```
  4. Health checks:
     ```typescript
     @Get('/health')
     async healthCheck(): Promise<HealthCheckResult> {
       const dbCheck = await this.prisma.$queryRaw`SELECT 1`;
       const redisCheck = await this.redis.ping();
       const llmCheck = await this.llmProvider.healthCheck();
       
       