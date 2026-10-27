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
| Phase 3 – Agent System Enhancement | **Done** (2026-10-26) | Re-scoped below. Tasks 11–15 done; end-to-end run documented in `docs/phase3-e2e/` |
| Phase 4 – Workflow Engine Enhancement | **Done** (2026-10-26) | Re-scoped below: sub-workflows as child runs, immutable versions + snapshot rollback, parallel with dependencies, typed templates; 5 engine defects fixed. End-to-end run in `docs/phase4-e2e/` |
| Phase 5 – Enterprise Features & Security | **Done** (2026-10-26) | Re-scoped below: roles admin / board member / viewer plus project ownership, append-only audit log, API keys on `/api/v1`, signed webhooks, PDF/CSV/JSON export and a weekly workspace report instead of email; 5 defects fixed. End-to-end run in `docs/phase5-e2e/` |
| Phase 6 – AI/ML Features & Testing | **Done** (2026-10-26) | Re-scoped below: role-specific agent analytics with anomaly alerts, a per-role effort/cost regression measured by leave-one-out error, static analysis of generated code with one DEV refinement round, 90% coverage gate on the domain, a budgeted load test; 4 defects fixed. End-to-end run in `docs/phase6-e2e/` |
| Phase 7 – Documentation & Demo Preparation | **Done** (2026-10-27) | Re-scoped below: thesis with measured numbers only, all 39 UML diagrams rendering, a repeatable demo on the production stack, Docker Compose deployment with migrations and a production config check; 10 defects fixed, including a WebSocket approval bypass. End-to-end run in `docs/phase7-e2e/` |

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

**Known gaps carried into later phases** (not regressions): ~~`domain/agent/strategies/ThinkingStrategy.ts` duplicates the module strategies~~ (removed in Task 11); `MetricsHandler` / ~~`AuditLogHandler`~~ / `NotificationHandler` are stubs (`AuditLogHandler` done in Phase 5; notifications are covered by webhooks); ~~`EmbeddingService` needs `OPENAI_API_KEY` or memory search returns nothing~~ (keyword fallback since Task 14); ~~Jest's 90% global coverage threshold fails `jest --coverage` today~~ (Task 27: 90% gated on `src/domain`, global floor); ~~generated tests are written but not executed yet~~ (executed since Task 12). ~~Phase 1 class/sequence/activity diagrams still mention DevOps~~ (refreshed in Task 11).

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
4. Recommendation (applied in Task 27): NFR2.1's 90% global unit coverage is very ambitious for the remaining weeks; consider gating 90% on `src/domain` + application services/strategies and reporting the rest.

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

**Task 12: Executable QC Verification** — ✅ Done (2026-10-26)
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
- **Result (2026-10-26)**:
  1. The Architect skeleton now also renders `package.json` (jest, ts-jest, typescript), `tsconfig.json` and `jest.config.js` (`ts-jest` with `isolatedModules`, so a type error fails only the test that hits it).
  2. `SandboxExecutor.runInWorkspace(dir, command, limits, options)` takes the project folder (from `ProjectWorkspace.projectDir`) rather than an id, to keep the tools module independent of the workspace module. The folder is bind-mounted **read-only** at `/workspace` and copied to a tmpfs `/work` before the command runs. The root filesystem is read-only, all capabilities are dropped, `no-new-privileges` and a PID limit are set, and the network is `none` unless `SANDBOX_REGISTRY_URL` names a package mirror. Docker log frames are demultiplexed so a large JSON report stays intact. Without Docker, a local fallback runs in a temp copy with a `node_modules` link. It is **opt-in** (`SANDBOX_ALLOW_LOCAL_RUN=true`) because it runs generated code on the API host.
  3. `ProjectTestRunner` (agents/services) runs `jest --json` and prints the report after a marker, so the workspace is never written. `JestReportMapper` maps each test to a use case by the `UC-xxx` id in its titles, else in its file name, else by use case name. A file that fails to load counts as a failure of its use cases. `TraceabilityService.build(..., execution)` sets `Passing | Failing | Missing` (or the old `Covered | Missing` when the tests could not run, with the reason in the matrix). Coverage counts passing use cases. `ooadMetadata.traceability` stores `executed`, passing and failing counts, `failingUseCases` and `testsPassed`/`testsFailed`.
  4. `TraceabilityService.qcPassed`: coverage ≥ 80% and no failing High-priority use case. `QcOutput` adds `testsExecuted`, `failingUseCases` and `failingTests`. The workflow merges them into the variables, and QA's prompt lists the failing tests and rejects when one belongs to a High-priority use case.
  5. Not done (optional): a separate `qc_condition` node. The QA reject edge already sends failing High-priority use cases back to DEV, so a second loop would only duplicate it.
  - Side fix: the API's Jest config now ignores `apps/api/workspace/`. Before, generated projects' `tests/*.spec.ts` would have run as part of the platform's own suite.
  - **Verification**: `nest build` 0 errors. Jest 25/25 suites, 394 tests. The new `qc-verification.spec.ts` covers the read-only, confined mount options, refusal of the local fallback, that the project folder is unchanged after a run, the Jest JSON mapping, the `qc_passed` rules (all pass, one High failing at 80%, Low failing tolerated, missing tests) and a **real Jest run** of a generated project whose broken `placeOrder` comes out as UC-001 *Failing*.

---

**Task 13: Generated Project Artifacts API & UI** — ✅ Done (2026-10-26)
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
- **Result (2026-10-26)**:
  1. `modules/project-artifacts/`: `ProjectArtifactsController` (JWT-guarded) serves `GET /api/projects/:id/files` (path, size, kind), `GET /api/projects/:id/files/*` (content, 1 MB cap → 413), `GET /api/projects/:id/archive` (zip, entries under `<project-slug>/`, `node_modules` excluded) and `GET /api/projects/:id/quality-gates` (gate history with score). `ProjectArtifactsService` reads only through `ProjectWorkspace`, which gained `readBuffer`/`stat`. The zip is built by a small dependency-free `ZipWriter` (deflate, CRC-32, UTF-8 names; checked with Python's `zipfile`). CORS exposes `Content-Disposition` so the browser keeps the file name.
  2. Web: an *Artifacts* tab in Project Detail (`components/artifacts/`) with a file tree, Markdown rendered by a small parser into React elements (tables, lists, code, so no HTML injection), PlantUML through the server in `VITE_PLANTUML_SERVER` (deflate + PlantUML base64; empty value → source only), and code/JSON with line numbers. The zip is downloaded with the JWT header.
  3. `quality_gate_result` and `quality_warning` are now in `WebSocketEventType` with typed payloads. `useQualityEvents` (Project Detail level) collects them live, merges them with the stored gate history (latest per gate) and refreshes the artifact queries.
  4. `/api/ooad-metrics/project/:id` also returns QC's `traceability` summary. The OOAD summary card shows use cases, entities, patterns, gate pass rate and coverage with passing / failing / missing use cases.
  - Docs: UC-026 *Browse Generated Project Artifacts*, FR-PROJ-008 (matrix recount: 76 / 1 / 9 of 86), component and package diagrams.
  - Not done: the Virtual Office does not show quality events yet (Project Detail does). Web tests cover the logic modules (tree, Markdown parser, PlantUML encoding, gate and warning merging) with Vitest in node. The web package has no jsdom / Testing Library, so components were checked with Playwright screenshots against a mocked API instead.
  - **Verification**: `nest build` 0 errors. API Jest 26/26 suites, 405 tests; the new `project-artifacts.spec.ts` runs a real HTTP server and covers auth 401, the list, content, `..` and `%2f` traversal → 400, unknown project/file → 404, a zip containing `docs/`, `src/` and `tests/` with valid CRCs, and the gate history. Web: `tsc` clean, Vitest 20/20, `vite build` OK. API boot maps the 4 new routes.

---

**Task 14: Agent Learning & Memory Refinement** — ✅ Done (2026-10-26)
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
- **Result (2026-10-26)**:
  1. The outcome signals arrive *after* the graded execution (the gate runs after the Architect, QC after DEV, QA after QC). So `AgentLearningHandler` (new `modules/learning/`, subscribed to the global `EventBus`) grades on the signal events, not on the agent's own completion. `QualityGateHandler` now publishes a `QualityGateEvaluatedEvent` (→ BA and Architect). QC's `AgentCompletedTaskEvent` (`qc_passed`, coverage, failing use cases) → DEV. QA's (`qa_approved` plus the first findings) → DEV and QC. The mapping is the pure `OutcomeSignalPolicy`. Each `ExecutionOutcome` (value object, `domain/agent/learning/`) is stored as a memory in `execution_outcomes`, with the structured outcome in its metadata; failures get importance 7, successes 4.
  2. `MemoryService.refineMemory(role, namespace, summarize)` selects the last 20 memories and stores the summary as a `lessons_learned` memory (importance 9). The summariser is passed in, so the memory module does not depend on agents. `LearningService.refine` supplies an LLM summariser through `AgentLLMService.providerFor(profile)`, so the call is costed. It runs every `LEARNING_REFINE_EVERY` (default 3) outcomes of a role, in the background, because `EventBus.publish` awaits its handlers.
  3. All thinking strategies use `MemoryService.recall()`: the role's top 3 lessons first (prefixed `Lesson learned:`), then the namespace search. Every action prompt already includes `thought.memories`.
  4. Without an embedding provider (`EmbeddingService.isEnabled()`), memories are saved without a vector and `searchMemories` ranks by keyword overlap × 0.7 + importance × 0.3, falling back to importance and recency when nothing matches.
  5. `GET /api/agents/:role/learning` returns the success rate, a per-day timeline, per-signal counts, the top lessons and recent outcomes. Agent Detail shows them in a *Learning* card (stat tiles, a single-series line chart with tooltip, lessons, outcomes).
  - Docs: FR-MEM-006/007 (matrix recount: 78 / 1 / 9 of 88), class diagram `docs/diagrams/classes/learning-loop.puml`.
  - **Verification**: `nest build` 0 errors. Jest 27/27 suites, 419 tests. The new `learning.spec.ts` covers the policy for every signal and ignored case, refinement on the N-th outcome only (and `LEARNING_REFINE_EVERY`), a lesson refined from outcomes appearing in the next action prompt (the mock LLM captures it), the keyword fallback without embeddings, lessons recalled first with role isolation, and the stats timeline. Web `tsc` and build pass, and the Learning card was checked in a Playwright screenshot.

---

**Task 15: Agent Collaboration Patterns** — ✅ Done (2026-10-26)
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
- **Result (2026-10-26)**:
  1. `AclMessage` (value object, `domain/collaboration/`) carries a FIPA-ACL performative, sender, receiver, conversation id and `inReplyTo`; `AclProtocol` says which performative may answer which (a REQUEST is answered by INFORM or REJECT, a PROPOSE by ACCEPT or REJECT; ACCEPT and REJECT must answer something). `AgentMessageBus` (Mediator, `modules/orchestrator/`) is the only channel between agents: it checks every reply against the conversation (known message, sent to the replier, allowed performative), stores it as an `AgentMessage` with `messageType 'acl'` and the ACL fields in its metadata, and notifies `on(role)` listeners. Persistence and listener errors are logged, protocol errors throw. The orchestrator's ad-hoc `"Action taken: {json}"` text is now one INFORM line (`Completed implement: Wrote 3 file(s) ...`).
  2. Fixed on the way: `AgentMessageService` emitted the raw Prisma row, while the Meeting Room reads `AgentMessageEvent` (`fromAgent`, `toAgent`, `timestamp`), so agent messages showed no sender. It now emits the event shape, plus the ACL fields; the Meeting Room shows a coloured performative tag and the pattern name.
  3. New task types on existing roles (RoleProfile only, no new agent): DEV `planImplementation` (plan + `QUESTION: UC-xxx:` lines), Architect `reviewPlan` / `reviewCode` (`DECISION: ACCEPT|REJECT`, feedback), BA `clarifyUseCase` (answer, and an updated use case validated by `UseCaseItemSchema`, merged into `ooadMetadata` without touching the design and re-rendered to `use-cases.md`). DEV's implement prompt now includes the accepted plan, the Architect's feedback and BA's clarifications.
  4. `agent_collaboration` node (`AgentCollaborationStrategy`, registers itself with the engine like `QualityGateStrategy`) runs a pattern from `CollaborationRegistry`. Each agent turn is a synthetic `agent_task` node run through `ctx.executeNode`, so it is a normal workflow step (logging, events, variables, Kanban moves for `implement` / `review` only). Patterns: `pair_develop` (SD-007), `review_chain` (`ReviewHandler` Chain of Responsibility; default QC advisory → QA deciding, more reviewers from node metadata; sets `qa_approved` and the edge), `clarification_loop` (DEV/QC → BA, at most 3 questions).
  5. `PAIR_WORKFLOW_DEFINITION` (`pair-project-workflow`) replaces `develop → test → review → qa_condition` with `pair_develop → review_chain` (onFail back to `pair_develop`). `WORKFLOW_COLLABORATION=pair` makes it the workflow new projects start with; both definitions are registered.
  - Docs: FR-AGENT-014, FR-WF-011 (matrix recount: 80 / 1 / 9 of 90), FR-AGENT-012 updated; class diagram `docs/diagrams/classes/agent-collaboration.puml`; sequence diagram SD-007 in `docs/diagrams/sequences/` and `docs/design/sequence-diagrams.md`.
  - **Verification**: `nest build` 0 errors. Jest 28/28 suites, 450 passed (15 skipped). The new `collaboration.spec.ts` covers `AclMessage` validation and protocol, the bus (delivery, broadcast, persistence shape, reply validation, failure isolation), each pattern with scripted agents (exact message and turn order, revision rounds, `maxRounds`, extra reviewers, early stop), the node (synthetic steps, merged variables, edge, failures) and the workflow variant; `agent-strategies.spec.ts` covers the four new task types. Web `tsc` and vitest (22 tests) pass.

---

**Phase 3 Definition of Done**
- Adding a 9th role touches only its profile, strategies and one provider entry
- QC coverage is based on executed tests; QA decisions reference real failures
- Every generated project can be browsed and downloaded from the UI
- `nest build`, Jest (new specs for every task) and web `tsc` stay green; one end-to-end run documented with screenshots for the thesis

_Status 2026-10-26: all met. `nest build` 0 errors, Jest 28/28 suites (452 passed, 15 skipped), web `tsc`, vitest and build pass. End-to-end run on PostgreSQL + Redis with a scripted OpenAI-compatible LLM: `docs/phase3-e2e/README.md` (20 workflow steps incl. pair_develop and review_chain, generated tests executed, Meeting Room and Artifacts screenshots)._

---

### **Phase 4: Workflow Engine Enhancement (Week 4-5)** — ✅ Done (2026-10-26)

> **Re-scoped on 2026-10-26.** The tasks keep their numbers and goals, with these corrections against the original text:
> - **Sub-workflows run inline as child runs** (Task 16). The original idea of `startWorkflow` + `waitForCompletion` would make a queue job wait for other queue jobs (deadlock risk with BullMQ concurrency) and would need polling. A `sub_workflow` node is executed by its own strategy, which walks the child definition node by node; each child is a `WorkflowRun` with `parentRunId`/`parentNodeId`, so the hierarchy is in the database. `human_approval` is not allowed inside a sub-workflow, because a child cannot pause on its own.
> - **Versioning means immutable definitions, not just a version string** (Task 17). Definitions are registered per `id@version`, runs are pinned to the version they started with, and definitions built from templates are stored in the database so their runs survive restarts. Rollback is **manual** (API/UI on a paused or failed run). Automatic rollback on failure was dropped: retries plus an explicit `onFail` edge already cover automatic recovery, and an automatic rewind would hide failures.
> - **Templates only use the 8 existing roles** (Task 19). The `ml_pipeline` template (DataScientist, MLEngineer) was dropped: those roles don't exist and adding them is outside the OOAD scope. Templates build definitions from **typed parameters** (they can switch nodes on and off) instead of replacing `${param}` strings in JSON, and they are code (a `WORKFLOW_TEMPLATES` multi-provider), not database rows. What is stored is every *instantiated* definition. User-defined templates are not in scope.
> - **Default behaviour is unchanged**: a project created without a template runs `default-project-workflow` (or the pair variant with `WORKFLOW_COLLABORATION=pair`). The web form proposes the *OOAD software project* template by default.

**Engine defects found and fixed during Phase 4**

| # | Finding | Fix |
|---|---------|-----|
| B1 | With Redis/BullMQ, a node that still failed after its retries threw inside the worker, so `handleJobCompletion` never ran and the run stayed `running` forever. Without Redis the opposite happened: the failure was passed on as `onFail`, and a node with a single unconditional edge then **continued down its success path** | The worker turns the error into a failure result; after a failed node only an explicit `onFail` edge is followed, otherwise the run is marked `failed` (`WorkflowGraph.nextAfterFailure`). A failed run can now be rolled back (Task 17) |
| B2 | Every node execution left a 5-minute timeout timer running (`Promise.race` without `clearTimeout`) | The timer is cleared when the node settles |
| B3 | Definitions lived only in memory: anything not hard-coded would be lost on restart | `WorkflowDefinitionVersion` table; stored versions are reloaded at startup, sub-workflows first |
| B4 | A registered definition could be changed through the object reference | The registry stores a deep-frozen copy |
| B5 | The Architect's design prompts always had an empty project description (`projectContext.description` is never set) | Falls back to the `projectDescription` variable, and node `constraints` are appended |

---

**Task 16: Sub-Workflows & Workflow Composition** — ✅ Done (2026-10-26)
- **Objective**: Hierarchical workflows built from reusable sub-workflows (Composite pattern).
- **Implementation**:
  1. `NodeType` gains `sub_workflow`; `WorkflowNode` gains `subWorkflowId` and `subWorkflowVersion` (`packages/shared-types`).
  2. `SubWorkflowStrategy` (self-registers with the engine like the quality gate, so the engine needs no change for it): creates a child `WorkflowRun` (`parentRunId`, `parentNodeId`, pinned version), runs each child node through the engine's `executeNode` (so every child node is a step of the child run, retried up to its `maxRetries`), follows the child's edges with `WorkflowGraph`, and limits loops to 3 visits per node like the engine.
  3. **Context isolation**: the child starts with a deep copy of the parent's variables (only `metadata.inputs` when given) and returns its variables (only `metadata.outputs` when given) when it completes. A failed child changes nothing in the parent.
  4. **Recursion**: the registry rejects a workflow that calls itself, requires referenced sub-workflows to be registered first and pins references to a version, so reference cycles can't be built. `MAX_DEPTH = 5` also guards nesting at run time.
  5. `domain/workflow/WorkflowGraph` is now the one place that decides the next node, for the engine and for child runs. It also lets an end node loop back (an OOAD gate or QA condition can be the end of a sub-workflow).
  6. Reusable sub-workflows (`modules/workflow/templates/sub-workflows.ts`): `ooad-analysis-design` (BA → Architect → OOAD gate, failed gate loops to the Architect), `ooad-build-verify` (DEV → QC → QA → condition, optional QA ‖ Marketing), `ooad-pair-build` (pair_develop → review_chain).
  7. API: `GET /api/workflows/runs/:runId` returns the run with its steps and the tree of child runs (`WorkflowRunQueryService`). The project's run list only shows top-level runs.
  8. UI (*Workflow Runs* tab): execution timeline with each sub-workflow step expandable/collapsible into the child run's steps, "open" to drill into a child run, breadcrumb back up (`components/workflow/WorkflowRunView.tsx`).
- **Tests** (`tests/unit/workflow/sub-workflows.spec.ts`, real engine over an in-memory repository): child run created and pinned, child steps on the child run, variables returned; input/output isolation; loop inside the child then completion; failed child leaves the parent unchanged and fails the run; self-reference, unknown and pausing sub-workflows rejected; run-time depth guard.
- **Demo**: create a project from the *OOAD software project* template → *Workflow Runs* shows `analysis_design` and `build` as nested sub-workflows.

**Task 17: Workflow Versioning & Rollback** — ✅ Done (2026-10-26)
- **Objective**: Changing a workflow never changes runs in flight, and a run can be put back to an earlier state.
- **Implementation**:
  1. `SemanticVersion` value object (`MAJOR.MINOR.PATCH[+build]`, build metadata ignored in ordering).
  2. `WorkflowDefinitionRegistry` replaces the engine's map: definitions are immutable per `id@version` (same content again is a no-op, other content throws `WorkflowVersionConflictError`), "latest" is the highest precedence. `WorkflowRun.workflowDefVersion` pins each run; `startWorkflow(…, version?)`.
  3. `WorkflowDefinitionVersion` table + `IWorkflowDefinitionRepository`: built-ins and instantiated templates are stored; on startup stored versions are reloaded. Built-ins in code win over a stored row with the same version but other content (that row means the code changed without a version bump).
  4. **Memento**: `WorkflowRunMemento` (domain) deep-copies node, status and context; the engine (originator) captures one before every top-level node (once per node, not per retry) and restores it; `WorkflowSnapshotCaretaker` stores them in the new `WorkflowSnapshot` table.
  5. `WorkflowEngine.rollbackWorkflow(runId, { snapshotId } | { steps })`: only paused or failed top-level runs; restores node and context, leaves the run **paused**, discards the target and later snapshots (the node is snapshotted again when it re-runs) and cancels pending approvals of the run.
  6. API: `GET /api/workflows/runs/:runId/snapshots`, `POST …/rollback`, `POST …/pause`, `POST …/resume`, `GET /api/workflows/definitions[/:id?version=]`.
  7. UI: snapshot list with *Roll back* (enabled when paused or failed) and *Resume*; the run header shows `id@version`.
  8. Not part of the memento: files in the project workspace (re-run agents rewrite them). Sub-workflow runs are not snapshotted; rolling back the parent re-runs the whole `sub_workflow` node.
- **Tests** (`parallel-and-rollback.spec.ts`, `sub-workflows.spec.ts`, `workflow-domain.spec.ts`): snapshot per node, kept across a "restart" (new engine, same storage); failed run → rollback 1 step → resume → completes; rollback 2 steps restores the earlier context and drops later snapshots; rollback to a chosen snapshot cancels the pending approval; refusals (running, sub-workflow run, no history); a paused v1 run keeps running v1 after v2 is registered; registry immutability, precedence, version pinning; memento isolation.
- **Demo**: stop the LLM gateway → create a project → the run fails at `start` → restart the gateway → *Roll back* → *Resume* → the run completes (see `docs/phase4-e2e/`).

**Task 18: Parallel Execution with Dependencies** — ✅ Done (2026-10-26)
- **Objective**: Parallel branches that may depend on each other, with a concurrency cap.
- **Implementation**:
  1. Parallel node metadata `branches: [{ nodeId, dependsOn? }]` and `concurrencyLimit` (`ParallelBranch` in shared types); the old `parallelNodes` list still works.
  2. `DependencyResolver` (domain): Kahn's algorithm for layers, `CyclicDependencyError` naming the nodes in the cycle, unknown/duplicate/self dependencies rejected. The validator checks every parallel node at registration.
  3. `ParallelStrategy` schedules by readiness instead of layer by layer: a branch starts as soon as its dependencies succeeded and a slot is free (never waits for a slow branch in the same layer). Branches whose dependency failed are **skipped**. The output has `layers` and a per-branch timeline (`startedAt`, `finishedAt`, `durationMs`, `layer`, `status`).
  4. Used by the *OOAD software project* template's *Announce while QA reviews* option: QA review and the Marketing announcement run as two branches after QC.
  5. UI: the execution timeline is a Gantt chart of all steps; steps of the same run that overlapped are outlined.
- **Tests**: dependency order, independent branches overlapping, layers and timeline in the step output, concurrency limit respected (max 2 active of 4), parallel faster than sequential (3 × 60 ms in < 170 ms), dependents of a failed branch skipped, cyclic definitions rejected; resolver unit tests.

**Task 19: Workflow Templates** — ✅ Done (2026-10-26)
- **Objective**: A library of parameterised workflows to start projects from.
- **Implementation**:
  1. `WorkflowTemplate` (domain, Template Method): `instantiate(params)` validates and coerces typed parameters (`string | number | boolean | enum`, required, min/max, options, unknown names rejected → `TemplateParameterError`), lets the subclass `build()` the main definition and its sub-workflows, then versions each definition as `<template version>+<content hash>`. Same content → same version (instantiating twice registers nothing new); a sub-workflow shared by two templates gets one version.
  2. Templates (`WORKFLOW_TEMPLATES` multi-provider, `WorkflowTemplateCatalog`): **OOAD software project** (`collaboration` sequential/pair, `minUseCases`, `announcement`, `parallelMarketing`, `humanApproval`), **REST API backend** (`database` PostgreSQL/MongoDB/In-memory → passed to the Architect as a node `constraints` value, `minUseCases`), **OOAD analysis & design** (`minUseCases`, `humanApproval`).
  3. `WorkflowDefinitionService.previewTemplate` (validates against a scratch registry, registers nothing) and `instantiateTemplate` (registers and stores sub-workflows first, then the main definition).
  4. `POST /api/projects` accepts `templateId` and `templateParams`; a bad choice is rejected (400/404) **before** the project is created. The run is pinned to the instantiated version and records `workflowTemplate` in its variables.
  5. API: `GET /api/workflows/templates`, `POST /api/workflows/templates/:id/preview`.
  6. UI: the *New Project* form has a workflow picker with a parameter form generated from the template and a live preview of the nodes, with sub-workflows and parallel branches expanded (`components/workflow/TemplatePicker.tsx`).
- **Tests** (`templates.spec.ts`): every built-in template instantiates into valid, pinned definitions; parameters switch nodes on/off and reach the gate criteria; parallel option; content-based versions; the database constraint reaches the Architect agent's input; parameter validation messages; 400/404 mapping; registration order and storage; reload after restart with rows out of order; full template run end to end through both sub-workflows. Project service: template instantiated and pinned, invalid choice rejected before anything is created.

**Phase 4 verification (2026-10-26)**: `nest build` 0 errors; API Jest 32/32 suites, 504 passed (15 skipped), up from 452; web `tsc` clean, Vitest 29/29, `vite build` OK. End-to-end run on PostgreSQL + Redis (BullMQ) with the scripted LLM: see `docs/phase4-e2e/README.md`. Diagrams: `docs/diagrams/classes/workflow-engine-phase4.puml`, `sequences/SD-006-workflow-rollback.puml` (rewritten: it described a Saga/compensation service that was never built), `sequences/SD-008-sub-workflow-execution.puml`. PlantUML rendering is blocked in the build container, so the diagrams were not rendered here.

---

### **Phase 5: Enterprise Features & Security (Week 5-6)** — ✅ Done (2026-10-26)

> **Re-scoped on 2026-10-26.** The tasks keep their numbers and goals, with these corrections against the original text:
> - **No `AGENT` user role** (Task 20). Agents never call the HTTP API: they run inside the engine and their tools are already limited per role by `ToolRegistry` (NFR-SEC-004). The roles are `admin`, `board_member` and a new read-only `viewer`. Agent actions are still audited, with actor type `agent`.
> - **Permissions alone were not enough**: any board member could change or approve any project. Changing a project, its tasks and milestones, controlling its runs and answering its approvals now also requires **owning the project** (admin is exempt). The permission list was merged to 13 permissions (`workflow:start/pause` → `workflow:control`, task and milestone writes → `task:manage`) so it can be shown and reasoned about as one matrix.
> - **API keys only work on the versioned integration API** `/api/v1` (Task 22); everything else needs a user token. A key acts as its owner, limited to its scopes, and dies with the owner's account.
> - **Email was dropped from the weekly report** (Task 23): the platform has no mail server and adding one is outside the OOAD scope. The weekly report is written as Markdown into each active project's workspace (visible in *Artifacts*) and announced through the `report.generated` webhook, which can feed any mail or chat tool.
> - **The rate limiter is in memory** (fixed window, one API instance). It sits behind the `IRateLimiter` port, so a Redis implementation can replace it without touching the guard.
> - OpenAPI documents the integration API (`/api/docs`), not every internal route. The schema is applied with `prisma db push` like in earlier phases.

**Defects found and fixed during Phase 5**

| # | Finding | Fix |
|---|---------|-----|
| C1 | `ApprovalRequestedEvent` was never raised: `ApprovalService.createApprovalRequest` was dead code and `HumanApprovalStrategy` created approvals directly | The strategy publishes the event (tested in `workflow-events.spec.ts`); it now reaches the audit log and the `approval.requested` webhook |
| C2 | Nothing published a workflow failure | The engine raises `WorkflowFailedEvent` on a dead end or the loop limit |
| C3 | `AuditLogHandler` was a stub, and `quality.gate.evaluated` / `agent.error` reached no audit or notification subscriber | The handler persists audit entries for 11 domain events |
| C4 | Many read routes (project lists, cost, metrics, workflows) had no guard, and roles were only checked on a few routes with `@Roles` | One global guard chain; every route is authenticated unless marked `@Public` (health, login, register) and declares its permission |
| C5 | Any authenticated user could approve any approval and edit or delete any project | Ownership and assignee checks (`AuthorizationService`), recorded as `access.denied` when refused |

---

**Task 20: Role-Based Access Control (RBAC)** — ✅ Done (2026-10-26)
- **Objective**: Permissions per role, enforced on every request and reflected in the UI.
- **Implementation**:
  1. Shared contract (`packages/shared-types/src/security.types.ts`): `Permission` (13), `UserRoleName` (admin, board_member, viewer).
  2. Domain (`domain/security`): `UserRole` value object, `RolePolicy` (the single permission matrix), `Principal` (user or API key; `can(permission)`, `owns(ownerId)`), `AccessDeniedError`.
  3. Global guard chain (`modules/access`): `AuthenticationGuard` (JWT, or API key on `@AllowApiKey` routes) → `RateLimitGuard` → `PermissionGuard` (`@RequirePermission`). `AuthorizationService` checks project, run and approval ownership.
  4. `User.isActive`; `UsersController`: `GET /api/users`, `GET /api/users/roles`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/active` (no change to oneself, the last active admin is protected). `GET /api/auth/me` returns the current permissions.
  5. Web: `usePermission` hides or disables what the user cannot do (New Project, card actions, approval buttons, run controls, agent model selects), the menu is filtered, `RequirePermission` guards routes, new *Users & Roles* page with the matrix.
- **Tests**: `security-domain.spec.ts` (policy, principal, key scopes ∩ role), `access-http.spec.ts` (a real Nest app: 401/403, public routes, ownership, API key only on `/v1`, rate limits), `services.spec.ts` (user admin rules), web `permissions.test.ts`.
- **Use cases**: UC-029 (new). **Diagram**: `classes/enterprise-phase5.puml`.

**Task 21: Audit Logging** — ✅ Done (2026-10-26)
- **Objective**: Who did what, when, from where, and what changed.
- **Implementation**:
  1. Domain (`domain/audit`): `AuditEntry` (append-only, secrets redacted), `ChangeSet` (before, after and per-field diff, `updatedAt` ignored), `IAuditLogRepository`, `AnomalyDetector` with `RepeatedFailedLoginRule` (5 in 15 min) and `AccessDeniedBurstRule` (10 in 10 min).
  2. `AuditLog` table (`PrismaAuditLogRepository`); no update or delete path.
  3. Three sources: `@Audited` controller actions through the global `AuditInterceptor`, which loads the resource before and after via `AuditSnapshotRegistry` (modules register loaders for projects, tasks, milestones, runs, approvals, agents and users); domain events through `AuditLogHandler` (Observer); `access.denied` from the guards and `AuthorizationService`. Logins are recorded both when they succeed and when they fail.
  4. API: `GET /api/audit` (filters, pages), `GET /api/audit/export` (CSV with BOM), `GET /api/audit/anomalies`.
  5. Web: *Audit Log* page with anomaly warnings, filters, expandable entries showing the field changes, CSV export.
- **Tests**: `audit-domain.spec.ts` (diff, redaction, rules and windows), `services.spec.ts` (interceptor before/after, handler mapping, CSV), `access-http.spec.ts` (denials recorded).
- **Use cases**: UC-030 (new).

**Task 22: Integration APIs** — ✅ Done (2026-10-26)
- **Objective**: External tools can drive and observe AI-CORP safely.
- **Implementation**:
  1. Domain (`domain/integration`): `ApiKey` (`aic_<id>_<secret>`, SHA-256 hash stored, timing-safe compare, scopes within the owner's role, expiry, revocation), `Webhook` + `WebhookUrl` (http(s) only, no credentials, private/loopback/link-local addresses refused, including IPv4-mapped IPv6), `WebhookSignature` (HMAC-SHA256 over `"<timestamp>.<body>"`), `FixedWindowRateLimiter`.
  2. Tables `ApiKey`, `Webhook`, `WebhookDelivery` and their repositories.
  3. `WebhookDispatcher` (Observer on the event bus) maps 8 events (`project.created`, `workflow.started/completed/failed`, `approval.requested`, `quality.gate.evaluated`, `agent.error`, `report.generated`) and delivers in the background: DNS re-checked at send time, retries with exponential backoff for 5xx/408/429/network errors, every delivery recorded.
  4. `/api/v1` (`IntegrationV1Controller`): list/create projects, status, cost report, export, webhooks. OpenAPI at `/api/docs`. Rate limits: per API key (`API_RATE_LIMIT_PER_MINUTE`, default 100), login 10/min per IP + email, register 5/min per IP.
  5. Management API `/api/integrations/{events,api-keys,webhooks}` with test delivery and delivery history; web *Integrations* page.
- **Tests**: `integration-domain.spec.ts`, `webhooks.spec.ts` (a real HTTP receiver: signatures, retries, refusals, no retry on 4xx), `access-http.spec.ts`, `reporting.spec.ts` (OpenAPI document).
- **Use cases**: UC-031, UC-032 (new). **Sequences**: `SD-009-api-key-request.puml`, `SD-010-webhook-delivery.puml`.

**Task 23: Data Export & Reporting** — ✅ Done (2026-10-26)
- **Objective**: Reports for stakeholders and exports for other tools.
- **Implementation**:
  1. Domain (`domain/reporting`): `CostReportBuilder` (by agent, model and day, budget used), `PerformanceReportBuilder` (runs, success rate, average and p95 duration, retries per role or node; success rate is empty, not 0, when no step finished), `IsoWeek`, `csvCell` (formula escaping).
  2. Exporters (Strategy, `PROJECT_EXPORTERS` multi-provider): JSON (full snapshot), CSV (tasks), PDF (`pdfkit`: summary, OOAD quality, cost bar chart, performance, milestones, tasks, runs; Unicode font for Vietnamese via `PDF_FONT_PATH` or system fonts). Adding a format means adding one class.
  3. `ProjectReportingService` (read side) and `ProjectExportService`. API: `GET /api/reports/projects/:id/cost`, `GET /api/reports/performance`, `GET /api/projects/:id/export?format=`.
  4. `WeeklyReportScheduler`: once per ISO week per active project, writes `reports/weekly-<week>.md` and raises `ReportGeneratedEvent`; `POST /api/reports/weekly/run` for admins.
  5. Web: *Reports* tab in Project Detail (export buttons, cost by agent and model, agent performance).
- **Tests**: `reporting-domain.spec.ts` (builders, ISO weeks, CSV), `reporting.spec.ts` (each exporter, PDF fonts, scheduler idempotency, OpenAPI).
- **Use cases**: UC-022 (rewritten, now implemented), UC-008 (viewer access). **Sequence**: `SD-011-project-export.puml`.

**Phase 5 verification (2026-10-26)**: `nest build` 0 errors; API Jest 41/41 suites, 595 passed (15 skipped), up from 504; web `tsc` clean, Vitest 33/33, `vite build` OK. End-to-end run on PostgreSQL + Redis with the scripted LLM and a real webhook receiver: 44/44 checks, see `docs/phase5-e2e/README.md`. Traceability: FR-AUTH-003/005, FR-AUD-001–003, FR-INT-001–003, FR-REP-001–003, NFR-SEC-007–010 in `docs/requirements/traceability-matrix.md`; admin use-case diagram updated. PlantUML rendering is blocked in the build container, so the diagrams were not rendered here.

---

### **Phase 6: AI/ML Features & Testing (Week 6-7)** — ✅ Done (2026-10-26)

> **Re-scoped on 2026-10-26.** The tasks keep their numbers and goals, with these corrections against the original text:
> - **No TensorFlow.js and no per-task model trained on ≥ 50 tasks** (Task 25). The platform records no human hours, and a thesis demo will never have hundreds of finished tasks. What it does record is each agent step's duration and LLM cost, so the model forecasts **agent time and LLM cost per project and role** from finished projects: a ridge linear regression on two features (description length, number of use cases), the median when a role has fewer than 6 samples, and the leave-one-out error as the honest accuracy measure. The PM's task estimates are derived from the forecast (port `ITaskCostEstimator`), and every forecast is compared with the outcome.
> - **No ESLint/SonarQube/Istanbul in the sandbox and no "debt in hours"** (Task 26). The generated code is TypeScript, so the platform analyses it with the TypeScript compiler API behind the `ICodeAnalyzer` port: syntax, McCabe complexity, maintainability index, unsafe calls, secrets, **OOAD layer violations** and use case references. Code predicted to fail QA is refined **once** by the DEV agent (bounded cost), and the prediction is measured against the real QA verdicts instead of being claimed.
> - **Analytics quality is role-specific** (Task 24): DEV is judged by QA approvals, QC by its test results, the Architect by the OOAD gate, the others by first-attempt success. Anomalies reuse the Phase 5 event, audit and webhook path (`agent.anomaly`).
> - **90% coverage is gated on `src/domain`** (Task 27), with a floor for the rest, as recommended in the Status & Audit section. 90% on controllers and Nest wiring would test framework glue.
> - **No Artillery/Clinic and no 1 000 users** (Task 28). One dependency-free script with budgets per endpoint, run at 20 users (the budget's target) and 50 (saturation) on the demo stack; what it found was fixed.

**Defects found and fixed during Phase 6**

| # | Finding | Fix |
|---|---------|-----|
| D1 | `BaseAgent` kept **one state machine per role**: two runs of the same role at once failed with "Invalid state transition: IDLE → ERROR", and after a permanent error the role stayed in `ERROR` and refused every later task until restart | One `AgentStateMachine` per `execute()` (tracked in a set; `getState()` reports the latest running one). Tests: concurrent tasks, and a permanent failure that does not block the next task (`base-agent.spec.ts`) |
| D2 | `Task.getCostVariance()` threw for every task under its estimate (`Money` cannot be negative) | Returns a signed number of dollars (found by the new domain tests) |
| D3 | `GET /projects` loaded every project's latest run with its whole `context` JSON and the project's `ooadMetadata`, then dropped both | Selects only the DTO columns: 46 → 9 ms with ~120 projects (load test) |
| D4 | `GET /projects/:id` ran four independent reads one after another | `Promise.all`: 16 → 9 ms (load test) |

---

**Task 24: Implement Agent Performance Analytics** — ✅ Done (2026-10-26)
- **Objective**: Compare the agents over time, warn about anomalies.
- **Implementation**:
  1. Domain (`domain/analytics`): `AgentPerformanceAnalyzer` (per role: steps, success rate, average and p95 duration, cost per success, quality, trend against the previous period, rank; daily series; day × hour heatmap; QA prediction accuracy). Quality by `IQualitySignal` (Strategy): `QaApprovalSignal`, `QcPassSignal`, `OoadGateSignal`, `FirstAttemptSignal`.
  2. `AgentAnomalyDetector` with `IAgentAnomalyRule` (Strategy): success-rate drop (20 points), repeated failures (3 in a row), cost spike (×2), slowdown (×2), low quality (< 50%).
  3. `AgentAnalyticsService` loads two periods of steps, usage and gate results (outputs only for DEV, QA and QC); `GET /api/analytics/agents?days=&projectId=` (`report:view`). Indexes `WorkflowStep[agentRole, startedAt]`, `[startedAt]`.
  4. `AgentAnomalyMonitor` (Observer of `workflow.completed` / `workflow.failed`) checks the last 7 days and publishes each new anomaly once per role, type and day as `AgentAnomalyDetectedEvent` → audit log and the new `agent.anomaly` webhook.
  5. Web: *Agent Analytics* page (anomalies, totals, leaderboard, success line chart, cost per success, heatmap, estimation model and its accuracy).
- **Tests**: `agent-analytics-domain.spec.ts`, `phase6-services.spec.ts`, web `analyticsFormat.test.ts`.
- **Use cases**: UC-033 (new). **Diagram**: `classes/analytics-phase6.puml`.

**Task 25: Implement Task Estimation ML Model** — ✅ Done (2026-10-26, re-scoped)
- **Objective**: Forecast a project's agent time and LLM cost before it runs, and say how good the forecast is.
- **Implementation**:
  1. Domain (`domain/estimation`): `LinearRegression` (ridge least squares), `IEstimator` with `RegressionEstimator` (floor at the smallest value seen) and `MedianEstimator`, `EstimationModel.train()` (per role, regression from 6 samples, leave-one-out MAPE/MAE), `forecast()` with confidence low/medium/high, `compareForecast()`. Port `ITaskCostEstimator`.
  2. `TrainingDataCollector`: one sample per finished project and role (latest top-level run completed).
  3. `ProjectEstimationService`: model cached until a run completes; stores `ProjectEstimate` rows (new table) at `start` (by `EstimationHandler` on `workflow.started`) and `planned` (when the PM creates tasks); `estimateTaskCost` = (DEV + QC + QA cost) / task count, used by `AgentTaskStrategy` to set `Task.estimatedCost`.
  4. API: `GET /api/projects/:id/estimate`, `GET /api/analytics/estimation`. Web: *Effort & cost forecast* card in Reports, model and accuracy tables in Agent Analytics.
- **Tests**: `estimation-domain.spec.ts`, `phase6-services.spec.ts`.
- **Use cases**: UC-024 (rewritten, implemented). **Diagram**: `AD-003` (rewritten).

**Task 26: Implement Code Quality Prediction** — ✅ Done (2026-10-26, re-scoped)
- **Objective**: Measure generated code, fix the worst of it before QA, and give QA evidence.
- **Implementation**:
  1. Domain (`domain/quality`): `FileMetrics`, `ICodeAnalyzer` port, `maintainabilityIndex()` (normalised, Visual Studio bands), `LayerRules` (domain ← application ← infrastructure / presentation), `CodeQualityPolicy` (capped penalties, LOC-weighted score, threshold 70, predicted QA verdict *fail* below it or on any syntax error or layer violation).
  2. Infrastructure: `TypeScriptCodeAnalyzer` (compiler API: diagnostics, per-function complexity, Halstead volume, security rules, imports and `require()` against the layer rules).
  3. `CodeQualityService`: analyses `src/**` (tests excluded), writes `docs/code-quality.md`, caches per file content and per project (invalidated when DEV rewrites the code). `GET /api/projects/:id/code-quality`.
  4. `DevActionStrategy.assureQuality`: if the prediction is *fail*, one refinement round with the findings; the rewrite is kept only if the score rises. `QaActionStrategy` adds a *STATIC ANALYSIS* section to the review. Env: `CODE_QUALITY_MIN_SCORE`, `CODE_QUALITY_REFINE=off`.
  5. Web: *Code quality* card in Reports.
- **Tests**: `code-quality.spec.ts` (analyzer, policy, layers), `phase6-services.spec.ts` (refinement kept / rejected / disabled, QA evidence, caches).
- **Use cases**: UC-023 (rewritten, implemented). **Diagram**: `AD-004` (rewritten).

**Task 27: Comprehensive Unit & Integration Testing** — ✅ Done (2026-10-26, re-scoped)
- **Objective**: Coverage gates that hold, on the code that carries the rules.
- **Implementation**: `jest.coverageThreshold`: `./src/domain/` 85% branches, 90% functions, lines and statements; global floor 55/64/70/70 (Jest measures the global floor on the files outside the path threshold). `npm run test:cov`. New `entities-and-value-objects.spec.ts` for the domain entities that had no direct tests (found D2). `tests/README.md` documents the gates.
- **Result**: domain 89.6% branches, 97.2% functions, 97.1% lines, 96.6% statements; whole API 76.1% statements.

**Task 28: Performance & Load Testing** — ✅ Done (2026-10-26, re-scoped)
- **Objective**: Know how the API behaves under concurrent use and keep it within budgets.
- **Implementation**: `scripts/perf/load-test.mjs` (Node 18, no dependency: weighted dashboard mix, optional project creation, p50/p95/p99 per endpoint, Markdown report, exit 1 on a missed budget) and `scripts/perf/budgets.json` (20 users; 100/500/1000 ms by default, 300/1500/3000 ms for analytics, forecast and code quality, 500/2000/3000 ms for project creation, ≤ 1% errors).
- **Findings fixed**: the code-quality endpoint parsed every file on each request (3.1 s p50 at 50 users; now cached, 196 ms), D3, D4. Throughput at saturation 98.8 → 178 req/s.
- **Result** (`docs/phase6-e2e/load-test.md`): 20 users, 202 req/s, 0 errors, every endpoint within budget except the cost report at 102 ms p50 (9 ms alone; CPU queueing on the shared 4-core box). 50 users saturate one process (Little's law ≈ 280 ms wait); scaling out is outside this phase.

**Phase 6 verification (2026-10-26)**: `nest build` 0 errors; API Jest 46/46 suites, 657 passed (15 skipped), up from 595; `npm run test:cov` passes its gates; web `tsc` clean, Vitest 38/38, `vite build` OK. End-to-end run on PostgreSQL + Redis with a scripted LLM (latency and priced model, a *Legacy* project refined by DEV, an *Unsafe* project rejected by QA, a Marketing outage) and a real webhook receiver: 21/21 checks, see `docs/phase6-e2e/README.md`. Traceability: FR-ANA-001–002, FR-EST-001–004, FR-CQ-001–003, NFR-PERF-006, NFR-QUALITY-003, NFR-ACCURACY-001 in `docs/requirements/traceability-matrix.md`. PlantUML rendering is blocked in the build container, so the diagrams were not rendered here.

---

### **Phase 7: Documentation & Demo Preparation (Week 7)** — ✅ Done (2026-10-27)

> **Re-scoped on 2026-10-27.** The tasks keep their numbers and goals, with these corrections against the original text:
> - **The thesis reports measured numbers only** (Task 29). The original outline claimed 92% coverage, a 15% improvement from learning and 50 projects/s; none of these was measured. The thesis uses the numbers of the e2e and load-test runs, and says plainly that the learning improvement cannot be measured with the scripted LLM (section 7.3) and what the experiment with a real LLM would be. Written in Vietnamese with an English title, as Markdown chapters in `docs/thesis/` built to PDF.
> - **Diagrams are rendered and checked, not redrawn** (Task 30). The 39 PlantUML sources already covered the views the plan asked for; 12 of them did not parse. A render script fails on the first broken diagram, so the catalogue stays correct.
> - **The demo runs on the production stack with a scripted LLM** (Task 31), so it is repeatable without an API key or network, and a recorded walkthrough is the fallback.
> - **Deployment is Docker Compose on one host** (Task 32), with migrations instead of `db push`, a production config check and real health checks. No cloud provider or Kubernetes.

**Defects found and fixed during Phase 7**

| # | Finding | Fix |
|---|---------|-----|
| E1 | `prisma/migrations` held only the initial schema (8 tables and many columns were added with `db push`), `migration_lock.toml` sat inside `0_init`, and the `vector` extension was never created, so a production database could not be built | Lock file moved to the migrations root, `CREATE EXTENSION vector` in `0_init`, new migration `20261027000000_platform_schema`; `migrate deploy` on an empty database then `migrate diff --exit-code` = no drift (`npm run db:check`) |
| E2 | **A viewer could approve over the WebSocket**: `human:approval_response` called the approval service directly, skipping permissions, the assignee check and the audit log (REST correctly returned 403) | The gateway refuses the message; the web app answers approvals over REST (`respondToApproval`); unit test and e2e check |
| E3 | Three different JWT fallbacks: REST and the WebSocket gateway signed and verified with different secrets when `JWT_SECRET` was unset | One `jwtSecret()` in `runtime-config.ts` |
| E4 | Production started with missing or placeholder secrets | `EnvValidator`: in production `JWT_SECRET` (≥ 32 characters) and `CORS_ORIGIN` are required and `CHANGE_ME`-style values are rejected; the API exits with every error listed |
| E5 | nginx stripped the `/api` prefix (every API call 404) and did not proxy Socket.IO | `apps/web/nginx.conf` proxies `/api/`, `/socket.io/` (upgrade) and `/plantuml/` |
| E6 | The API Dockerfile ran a file that does not exist and health-checked the wrong path | Two-stage build, `tini`, non-root user, `docker-entrypoint.sh` (migrate, optional seed, start), healthcheck on `/api/health/live` |
| E7 | `GET /health` answered 200 whatever the database state and did not check Redis | Redis `PING`, status unhealthy when the database is down → 503; `GET /health/live` for liveness |
| E8 | The seed printed the admin password and used a fixed one in production | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (≥ 12 characters in production); compiled seed for the runtime image |
| E9 | 12 of 39 PlantUML diagrams did not render (4 state machines, 6 sequences, 1 class, 1 component) | Sources fixed; `scripts/docs/render-diagrams.sh` renders all 39 to SVG and fails on a syntax error |
| E10 | Dashboard cards always showed "Starting… 0%" (the project list has no runs) and the total cost was not rounded | `projectProgress()` falls back to the project status (unit test); cost with 2 decimals |

---

**Task 29: Write IEEE-Format Thesis Documentation** — ✅ Done (2026-10-27, re-scoped)
- **Deliverable**: `docs/thesis/` — front matter (cover and declaration placeholders for the student, abstract, abbreviations), 8 chapters (introduction, background, requirements, design, implementation, testing and evaluation, discussion of RQ1–RQ3 with threats to validity, conclusion and future work), 55 IEEE references, appendices A–E (UML catalogue, API, test reproduction, performance, user guide).
- **Build**: `node scripts/docs/build-thesis.mjs` (pandoc + Playwright, A4, figures numbered per chapter) → `docs/thesis/AI-CORP-thesis.pdf`, 73 pages.
- **Numbers**: all from recorded runs (sections 6.2–6.8); no claim without a source.

**Task 30: Create Comprehensive UML Diagrams** — ✅ Done (2026-10-27, re-scoped)
- 39 diagrams in 6 views (4 use case, 13 class, 11 sequence, 4 activity, 4 state machine, 3 architecture); catalogue in `docs/diagrams/INDEX.md`, SVGs in `docs/diagrams/rendered/`.
- Fixes: E9; deployment diagram rewritten to match `docker-compose.prod.yml`.
- `scripts/docs/render-diagrams.sh`: downloads PlantUML 1.2024.7 (SHA-1 checked), renders every `.puml`, exits non-zero on the first error.

**Task 31: Prepare Demo Presentation** — ✅ Done (2026-10-27, re-scoped)
- `scripts/demo/demo-llm.cjs` (scripted OpenAI-compatible LLM, port 20128) and `scripts/demo/seed-demo.mjs` (board and viewer accounts, five projects: Online Bookstore, Legacy Billing, Unsafe Portal, Library Loans, Clinic Booking left waiting for approval; idempotent, ~25 s).
- `docs/demo/DEMO_SCRIPT.md`: 15-minute script in Vietnamese with setup, timeline, numbers to quote, fallbacks and Q&A.
- `docs/demo/record-walkthrough.cjs`: Playwright video of the walkthrough (fallback if the live demo fails).
- Slides: 14-slide deck for the defence (Claude artifact, exportable to PDF/PPTX).

**Task 32: Final Integration & Deployment** — ✅ Done (2026-10-27, re-scoped)
- `docker-compose.prod.yml`: PostgreSQL (pgvector), Redis (AOF), API, web (nginx), PlantUML server, and the scripted LLM under the `demo` profile; only the web port is published. `.env.production.example`.
- API: `runtime-config.ts` (JWT secret, CORS origins, Swagger switch), `EnvValidator` (E4), `enableShutdownHooks`, health (E7), WebSocket fixes (E2, E3). Migrations (E1), Dockerfiles (E6), nginx (E5), seed (E8).
- **Tests**: `tests/unit/deployment/production-readiness.spec.ts` (17 tests).
- **End-to-end**: `docs/phase7-e2e/` — 21/21 checks through nginx on the production build: config check, migrations without drift, health 503/200, Swagger off, CORS, WebSocket auth, viewer refused over REST and WebSocket, board approval, PDF export, analytics, audit trail.

**Phase 7 verification (2026-10-27)**: `nest build` 0 errors; API Jest 47/47 suites, 674 passed (15 skipped); web Vitest 41/41, `tsc` clean; Phase 7 e2e 21/21. Traceability: NFR-SEC-006 extended, NFR-SEC-011, NFR-REL-006 and NFR-DEPLOY-001–002 added in `docs/requirements/traceability-matrix.md`.
