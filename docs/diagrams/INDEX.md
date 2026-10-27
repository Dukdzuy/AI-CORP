# UML diagram catalogue

All diagrams are PlantUML sources in this folder; `scripts/docs/render-diagrams.sh` renders them to [`rendered/`](rendered/) (SVG) and fails on the first syntax error. Phase 7 (Task 30) fixed 12 sources that did not parse (4 state machines, 6 sequences, 1 class, 1 component diagram) and rewrote the deployment diagram to match `docker-compose.prod.yml`.

**39 diagrams** in 6 UML views.

## Use case diagrams (4)

UML use case diagrams: actors and platform use cases.

| Source | Title | Rendered |
|---|---|---|
| [`use-cases/admin-use-cases.puml`](use-cases/admin-use-cases.puml) | Admin Use Cases - System Administration (UML 2.5) | [SVG](rendered/use-cases/admin-use-cases.svg) |
| [`use-cases/agent-use-cases.puml`](use-cases/agent-use-cases.puml) | AI Agent Use Cases - Detailed Multi-Agent Workflow (UML 2.5) | [SVG](rendered/use-cases/agent-use-cases.svg) |
| [`use-cases/board-member-use-cases.puml`](use-cases/board-member-use-cases.puml) | Board Member Use Cases - Detailed View (UML 2.5) | [SVG](rendered/use-cases/board-member-use-cases.svg) |
| [`use-cases/overall-system.puml`](use-cases/overall-system.puml) | AI-CORP Multi-Agent Platform - Overall Use Case Diagram (UML 2.5) | [SVG](rendered/use-cases/overall-system.svg) |

## Class diagrams (13)

Domain model, aggregates and the design patterns as implemented.

| Source | Title | Rendered |
|---|---|---|
| [`classes/agent-aggregate.puml`](classes/agent-aggregate.puml) | Agent Aggregate - State Machine, Strategy & Observer Patterns | [SVG](rendered/classes/agent-aggregate.svg) |
| [`classes/agent-collaboration.puml`](classes/agent-collaboration.puml) | Agent Collaboration (Phase 3, Task 15) | [SVG](rendered/classes/agent-collaboration.svg) |
| [`classes/analytics-phase6.puml`](classes/analytics-phase6.puml) | Agent analytics, estimation and code quality after Phase 6 (Tasks 24-28) | [SVG](rendered/classes/analytics-phase6.svg) |
| [`classes/domain-model-overview.puml`](classes/domain-model-overview.puml) | AI-CORP Domain Model - Comprehensive Class Diagram | [SVG](rendered/classes/domain-model-overview.svg) |
| [`classes/enterprise-phase5.puml`](classes/enterprise-phase5.puml) | Security, audit, integration and reporting after Phase 5 (Tasks 20-23) | [SVG](rendered/classes/enterprise-phase5.svg) |
| [`classes/learning-loop.puml`](classes/learning-loop.puml) | Agent Learning Loop (Phase 3, Task 14) | [SVG](rendered/classes/learning-loop.svg) |
| [`classes/patterns-factory.puml`](classes/patterns-factory.puml) | Design Patterns - Factory Method & Abstract Factory | [SVG](rendered/classes/patterns-factory.svg) |
| [`classes/patterns-observer.puml`](classes/patterns-observer.puml) | Design Pattern - Observer Pattern (Agent Event System) | [SVG](rendered/classes/patterns-observer.svg) |
| [`classes/patterns-repository.puml`](classes/patterns-repository.puml) | Design Pattern - Repository Pattern (Domain-Driven Design) | [SVG](rendered/classes/patterns-repository.svg) |
| [`classes/patterns-strategy.puml`](classes/patterns-strategy.puml) | Design Pattern - Strategy Pattern (Thinking & Action Strategies) | [SVG](rendered/classes/patterns-strategy.svg) |
| [`classes/project-aggregate.puml`](classes/project-aggregate.puml) | Project Aggregate - Detailed Structure | [SVG](rendered/classes/project-aggregate.svg) |
| [`classes/workflow-aggregate.puml`](classes/workflow-aggregate.puml) | Workflow Aggregate - Orchestration & Approval | [SVG](rendered/classes/workflow-aggregate.svg) |
| [`classes/workflow-engine-phase4.puml`](classes/workflow-engine-phase4.puml) | Workflow Engine after Phase 4 (Tasks 16-19) | [SVG](rendered/classes/workflow-engine-phase4.svg) |

## Sequence diagrams (11)

Interactions behind the main use cases.

| Source | Title | Rendered |
|---|---|---|
| [`sequences/SD-001-project-creation.puml`](sequences/SD-001-project-creation.puml) | SD-001: Project Creation Workflow | [SVG](rendered/sequences/SD-001-project-creation.svg) |
| [`sequences/SD-002-agent-think-act-cycle.puml`](sequences/SD-002-agent-think-act-cycle.puml) | SD-002: Agent Think-Act Cycle | [SVG](rendered/sequences/SD-002-agent-think-act-cycle.svg) |
| [`sequences/SD-003-human-approval-flow.puml`](sequences/SD-003-human-approval-flow.puml) | SD-003: Human Approval Flow | [SVG](rendered/sequences/SD-003-human-approval-flow.svg) |
| [`sequences/SD-004-task-delegation-chain.puml`](sequences/SD-004-task-delegation-chain.puml) | SD-004: Task Delegation Chain (default OOAD workflow v2.0.0) | [SVG](rendered/sequences/SD-004-task-delegation-chain.svg) |
| [`sequences/SD-005-agent-learning-cycle.puml`](sequences/SD-005-agent-learning-cycle.puml) | SD-005: Agent Learning Cycle | [SVG](rendered/sequences/SD-005-agent-learning-cycle.svg) |
| [`sequences/SD-006-workflow-rollback.puml`](sequences/SD-006-workflow-rollback.puml) | SD-006: Workflow Snapshot & Rollback (Memento, Task 17) | [SVG](rendered/sequences/SD-006-workflow-rollback.svg) |
| [`sequences/SD-007-pair-develop.puml`](sequences/SD-007-pair-develop.puml) | SD-007: Pair Develop (agent_collaboration node, Task 15) | [SVG](rendered/sequences/SD-007-pair-develop.svg) |
| [`sequences/SD-008-sub-workflow-execution.puml`](sequences/SD-008-sub-workflow-execution.puml) | SD-008: Sub-workflow execution (Composite, Task 16) | [SVG](rendered/sequences/SD-008-sub-workflow-execution.svg) |
| [`sequences/SD-009-api-key-request.puml`](sequences/SD-009-api-key-request.puml) | SD-009: Integration API request with an API key (Tasks 20-22) | [SVG](rendered/sequences/SD-009-api-key-request.svg) |
| [`sequences/SD-010-webhook-delivery.puml`](sequences/SD-010-webhook-delivery.puml) | SD-010: Webhook delivery (Observer, Task 22) | [SVG](rendered/sequences/SD-010-webhook-delivery.svg) |
| [`sequences/SD-011-project-export.puml`](sequences/SD-011-project-export.puml) | SD-011: Project export (Strategy, Task 23) | [SVG](rendered/sequences/SD-011-project-export.svg) |

## Activity diagrams (4)

Business processes and algorithms.

| Source | Title | Rendered |
|---|---|---|
| [`activities/AD-001-project-lifecycle.puml`](activities/AD-001-project-lifecycle.puml) | Complete Project Lifecycle - Activity Diagram (default OOAD workflow v2.0.0) | [SVG](rendered/activities/AD-001-project-lifecycle.svg) |
| [`activities/AD-002-workflow-execution-parallel.puml`](activities/AD-002-workflow-execution-parallel.puml) | Workflow Execution with Parallel Branches - Activity Diagram | [SVG](rendered/activities/AD-002-workflow-execution-parallel.svg) |
| [`activities/AD-003-task-estimation-ml-pipeline.puml`](activities/AD-003-task-estimation-ml-pipeline.puml) | Effort & cost estimation (UC-024) - Activity Diagram | [SVG](rendered/activities/AD-003-task-estimation-ml-pipeline.svg) |
| [`activities/AD-004-code-quality-analysis-flow.puml`](activities/AD-004-code-quality-analysis-flow.puml) | Code quality analysis and refinement (UC-023) - Activity Diagram | [SVG](rendered/activities/AD-004-code-quality-analysis-flow.svg) |

## State machine diagrams (4)

Lifecycles of stateful entities.

| Source | Title | Rendered |
|---|---|---|
| [`state-machines/SM-001-agent-states.puml`](state-machines/SM-001-agent-states.puml) | Agent State Machine - State Transitions | [SVG](rendered/state-machines/SM-001-agent-states.svg) |
| [`state-machines/SM-002-workflow-states.puml`](state-machines/SM-002-workflow-states.puml) | Workflow State Machine - State Transitions | [SVG](rendered/state-machines/SM-002-workflow-states.svg) |
| [`state-machines/SM-003-task-states.puml`](state-machines/SM-003-task-states.puml) | Task Status State Machine - State Transitions | [SVG](rendered/state-machines/SM-003-task-states.svg) |
| [`state-machines/SM-004-approval-states.puml`](state-machines/SM-004-approval-states.puml) | Approval State Machine - State Transitions | [SVG](rendered/state-machines/SM-004-approval-states.svg) |

## Architecture diagrams (3)

Packages, components and deployment.

| Source | Title | Rendered |
|---|---|---|
| [`architecture/component-diagram.puml`](architecture/component-diagram.puml) | AI-CORP System Component Diagram | [SVG](rendered/architecture/component-diagram.svg) |
| [`architecture/deployment-diagram.puml`](architecture/deployment-diagram.puml) | AI-CORP Deployment Diagram (docker-compose.prod.yml) | [SVG](rendered/architecture/deployment-diagram.svg) |
| [`architecture/package-diagram.puml`](architecture/package-diagram.puml) | AI-CORP Package / Module Dependency Diagram | [SVG](rendered/architecture/package-diagram.svg) |
