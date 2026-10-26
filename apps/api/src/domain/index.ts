/**
 * Domain Layer
 * 
 * Central export point for the domain layer.
 * Contains core business logic, entities, and interfaces.
 * 
 * Following Domain-Driven Design (DDD) principles:
 * - Entities: Agent, Tool, Project, Task, Milestone
 * - Value Objects: AgentState, AgentContext, Money, ProjectStatus, TaskStatus
 * - Interfaces: Service contracts
 * - Domain Events: State changes, actions
 * 
 * @module domain
 */

// Agent Domain
export * from './agent/AgentState';
export * from './agent/AgentStateMachine';
export * from './agent/AgentEventEmitter';
export * from './agent/interfaces';
export * from './agent/AgentOutputs';
export * from './agent/learning/ExecutionOutcome';
export * from './collaboration/AclMessage';

// Tool Domain
export * from './tool/interfaces';

// Common Types
export * from './common/types';

// Value Objects (Task 7)
export * from './value-objects';

// Domain Entities (Task 7)
export * from './entities';

// Repository Interfaces (Task 6)
export * from './repositories';
