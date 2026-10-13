# AI-CORP Documentation Index

**Project:** Design and Development of a Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation  
**Version:** 1.0 — Phase 1 Complete  
**Date:** December 2024

---

## Overview

This `docs/` folder contains all OOAD (Object-Oriented Analysis and Design) documentation for the AI-CORP Multi-Agent Platform graduation thesis. The documentation follows UML 2.5 notation and academic OOAD methodology, covering requirements, analysis, design, and architecture phases.

```
docs/
├── README.md                          ← This file (documentation index)
├── PHASE1_COMPLETION_REPORT.md        ← Phase 1 summary and deliverables table
│
├── requirements/
│   ├── use-cases.md                   ← 25 fully specified use cases (UC-001 – UC-025)
│   └── traceability-matrix.md         ← Requirements → implementation traceability
│
├── design/
│   ├── domain-model.md                ← Domain model narrative (DDD aggregates)
│   ├── interfaces.md                  ← TypeScript interface contracts
│   ├── sequence-diagrams.md           ← Sequence diagram documentation
│   ├── state-machines.md              ← State machine specification (4 machines)
│   └── architecture.md                ← Architecture design + 6 ADRs
│
└── diagrams/
    ├── use-cases/                     ← 4 PlantUML use case diagrams
    ├── classes/                       ← 8 PlantUML class diagrams
    ├── sequences/                     ← 6 PlantUML sequence diagrams
    ├── activities/                    ← 4 PlantUML activity diagrams
    ├── state-machines/                ← 4 PlantUML state machine diagrams
    └── architecture/                  ← 3 PlantUML architecture diagrams
```

---

## How to Render PlantUML Diagrams

All diagrams are written in [PlantUML](https://plantuml.com/) syntax and saved as `.puml` files. Use any of the methods below to render them.

### Option 1: VS Code Extension (Recommended)

1. Install the [PlantUML extension](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) by `jebbs`
2. Open any `.puml` file in VS Code
3. Press `Alt+D` to preview, or right-click → **Preview Current Diagram**
4. Export to PNG/SVG: `Ctrl+Shift+P` → **PlantUML: Export Current Diagram**

**Requirement:** Java must be installed, or configure the extension to use the PlantUML server.

### Option 2: Online Editor

Visit [https://www.plantuml.com/plantuml/uml/](https://www.plantuml.com/plantuml/uml/) and paste the `.puml` file contents.

### Option 3: PlantUML JAR (Command Line)

```bash
# Download PlantUML jar from https://plantuml.com/download
java -jar plantuml.jar docs/diagrams/use-cases/overall-system.puml

# Export all diagrams at once
java -jar plantuml.jar -r docs/diagrams/**/*.puml -o rendered/
```

### Option 4: PlantUML Server (Docker)

```bash
docker run -d -p 8080:8080 plantuml/plantuml-server:jetty
# Then open http://localhost:8080 and paste diagram content
```

---

## Major Documents

### Requirements

| Document | Description | Path |
|----------|-------------|------|
| Use Case Specifications | 25 use cases with full detail | [`requirements/use-cases.md`](requirements/use-cases.md) |
| Traceability Matrix | Maps requirements to design to code | [`requirements/traceability-matrix.md`](requirements/traceability-matrix.md) |

### Design

| Document | Description | Path |
|----------|-------------|------|
| Domain Model | DDD aggregates, entities, value objects, domain events | [`design/domain-model.md`](design/domain-model.md) |
| Interface Contracts | TypeScript interface definitions | [`design/interfaces.md`](design/interfaces.md) |
| Sequence Diagrams | Narrative for 6 critical interaction scenarios | [`design/sequence-diagrams.md`](design/sequence-diagrams.md) |
| State Machines | 4 state machines: Agent, Workflow, Task, Approval | [`design/state-machines.md`](design/state-machines.md) |
| Architecture | Layered DDD architecture + 6 ADRs | [`design/architecture.md`](design/architecture.md) |

### Phase Report

| Document | Description | Path |
|----------|-------------|------|
| Phase 1 Completion Report | All deliverables, patterns, SOLID coverage, timeline | [`PHASE1_COMPLETION_REPORT.md`](PHASE1_COMPLETION_REPORT.md) |

---

## Diagrams Quick Reference

### Use Case Diagrams

| Diagram | Description | File |
|---------|-------------|------|
| Overall System | All actors and use cases overview | [`diagrams/use-cases/overall-system.puml`](diagrams/use-cases/overall-system.puml) |
| Board Member | Board member role use cases | [`diagrams/use-cases/board-member-use-cases.puml`](diagrams/use-cases/board-member-use-cases.puml) |
| Admin | Administrator role use cases | [`diagrams/use-cases/admin-use-cases.puml`](diagrams/use-cases/admin-use-cases.puml) |
| AI Agents | AI agent role use cases | [`diagrams/use-cases/agent-use-cases.puml`](diagrams/use-cases/agent-use-cases.puml) |

### Class Diagrams

| Diagram | Description | File |
|---------|-------------|------|
| Domain Overview | Full domain model with all aggregates | [`diagrams/classes/domain-model-overview.puml`](diagrams/classes/domain-model-overview.puml) |
| Agent Aggregate | Agent entity, state machine, roles | [`diagrams/classes/agent-aggregate.puml`](diagrams/classes/agent-aggregate.puml) |
| Project Aggregate | Project, Task, Milestone hierarchy | [`diagrams/classes/project-aggregate.puml`](diagrams/classes/project-aggregate.puml) |
| Workflow Aggregate | WorkflowRun, DAG nodes, BullMQ | [`diagrams/classes/workflow-aggregate.puml`](diagrams/classes/workflow-aggregate.puml) |
| Factory Pattern | AgentFactory, LLMFactory class hierarchy | [`diagrams/classes/patterns-factory.puml`](diagrams/classes/patterns-factory.puml) |
| Strategy Pattern | BaseAgent + 8 concrete agent strategies | [`diagrams/classes/patterns-strategy.puml`](diagrams/classes/patterns-strategy.puml) |
| Observer Pattern | DomainEvent, EventEmitter, subscribers | [`diagrams/classes/patterns-observer.puml`](diagrams/classes/patterns-observer.puml) |
| Repository Pattern | Domain interfaces + Prisma implementations | [`diagrams/classes/patterns-repository.puml`](diagrams/classes/patterns-repository.puml) |

### Sequence Diagrams

| Diagram | Description | File |
|---------|-------------|------|
| SD-001 | Project creation flow | [`diagrams/sequences/SD-001-project-creation.puml`](diagrams/sequences/SD-001-project-creation.puml) |
| SD-002 | Agent think-act cycle with LLM | [`diagrams/sequences/SD-002-agent-think-act-cycle.puml`](diagrams/sequences/SD-002-agent-think-act-cycle.puml) |
| SD-003 | Human approval gateway flow | [`diagrams/sequences/SD-003-human-approval-flow.puml`](diagrams/sequences/SD-003-human-approval-flow.puml) |
| SD-004 | Multi-agent task delegation chain | [`diagrams/sequences/SD-004-task-delegation-chain.puml`](diagrams/sequences/SD-004-task-delegation-chain.puml) |
| SD-005 | Agent learning and memory cycle | [`diagrams/sequences/SD-005-agent-learning-cycle.puml`](diagrams/sequences/SD-005-agent-learning-cycle.puml) |
| SD-006 | Workflow rollback and recovery | [`diagrams/sequences/SD-006-workflow-rollback.puml`](diagrams/sequences/SD-006-workflow-rollback.puml) |

### Activity Diagrams

| Diagram | Description | File |
|---------|-------------|------|
| AD-001 | Complete project lifecycle (9 swimlanes) | [`diagrams/activities/AD-001-project-lifecycle.puml`](diagrams/activities/AD-001-project-lifecycle.puml) |
| AD-002 | Workflow execution with parallel branches | [`diagrams/activities/AD-002-workflow-execution-parallel.puml`](diagrams/activities/AD-002-workflow-execution-parallel.puml) |
| AD-003 | ML task estimation pipeline | [`diagrams/activities/AD-003-task-estimation-ml-pipeline.puml`](diagrams/activities/AD-003-task-estimation-ml-pipeline.puml) |
| AD-004 | Code quality analysis pipeline | [`diagrams/activities/AD-004-code-quality-analysis-flow.puml`](diagrams/activities/AD-004-code-quality-analysis-flow.puml) |

### State Machine Diagrams

| Diagram | Description | File |
|---------|-------------|------|
| SM-001 | Agent lifecycle state machine | [`diagrams/state-machines/SM-001-agent-states.puml`](diagrams/state-machines/SM-001-agent-states.puml) |
| SM-002 | Workflow execution state machine | [`diagrams/state-machines/SM-002-workflow-states.puml`](diagrams/state-machines/SM-002-workflow-states.puml) |
| SM-003 | Task Kanban state machine | [`diagrams/state-machines/SM-003-task-states.puml`](diagrams/state-machines/SM-003-task-states.puml) |
| SM-004 | Approval gateway state machine | [`diagrams/state-machines/SM-004-approval-states.puml`](diagrams/state-machines/SM-004-approval-states.puml) |

### Architecture Diagrams

| Diagram | Description | File |
|---------|-------------|------|
| Component Diagram | All system components with interfaces | [`diagrams/architecture/component-diagram.puml`](diagrams/architecture/component-diagram.puml) |
| Deployment Diagram | Physical deployment, nodes, security zones | [`diagrams/architecture/deployment-diagram.puml`](diagrams/architecture/deployment-diagram.puml) |
| Package Diagram | Layer dependencies, Dependency Inversion | [`diagrams/architecture/package-diagram.puml`](diagrams/architecture/package-diagram.puml) |

---

## Thesis Chapters → Documentation Mapping

Use this table to find which documentation file(s) contribute to each thesis chapter:

| Thesis Chapter | Primary Documentation |
|---------------|----------------------|
| **Chapter 1: Introduction** | `README.md`, `PHASE1_COMPLETION_REPORT.md` (Executive Summary) |
| **Chapter 2: Literature Review / Background** | `design/architecture.md` (Section 2: Architecture Style) |
| **Chapter 3: Requirements Analysis** | `requirements/use-cases.md`, `diagrams/use-cases/*.puml` |
| **Chapter 4: System Analysis (OOAD)** | `design/domain-model.md`, `diagrams/classes/*.puml` |
| **Chapter 5: System Design** | `design/sequence-diagrams.md`, `design/state-machines.md`, `diagrams/sequences/*.puml`, `diagrams/state-machines/*.puml`, `diagrams/activities/*.puml` |
| **Chapter 6: Architecture Design** | `design/architecture.md`, `diagrams/architecture/*.puml` |
| **Chapter 7: Implementation** | Source code in `apps/` + `design/interfaces.md` |
| **Chapter 8: Testing** | `requirements/traceability-matrix.md` (test case column), test files in `apps/api/src/**/*.spec.ts` |
| **Chapter 9: Conclusion** | `PHASE1_COMPLETION_REPORT.md` (Sections 6, 7, 8) |

---

## Design Patterns Quick Lookup

For quick reference to which file demonstrates each design pattern:

| Pattern | File |
|---------|------|
| Factory Method | `diagrams/classes/patterns-factory.puml` |
| Abstract Factory | `diagrams/architecture/component-diagram.puml` |
| Strategy | `diagrams/classes/patterns-strategy.puml` |
| State | `diagrams/state-machines/SM-001-agent-states.puml` |
| Observer | `diagrams/classes/patterns-observer.puml` |
| Repository | `diagrams/classes/patterns-repository.puml` |
| Circuit Breaker | `design/architecture.md` (ADR-001, Section 3.3.2) |
| Command | `design/state-machines.md` (Section 7.3) |
| Memento | `diagrams/sequences/SD-006-workflow-rollback.puml` |
| Decorator | `diagrams/architecture/component-diagram.puml` |
| Facade | `diagrams/architecture/package-diagram.puml` |
| Chain of Responsibility | `design/state-machines.md` (Section 7.6) |

---

*For the complete deliverables list, design pattern catalog, SOLID coverage, and timeline, see [`PHASE1_COMPLETION_REPORT.md`](PHASE1_COMPLETION_REPORT.md).*
