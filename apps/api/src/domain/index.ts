/**
 * Domain Layer
 * 
 * Central export point for the domain layer.
 * Contains core business logic, entities, and interfaces.
 * 
 * Following Domain-Driven Design (DDD) principles:
 * - Entities: Agent, Tool
 * - Value Objects: AgentState, AgentContext, etc.
 * - Interfaces: Service contracts
 * - Domain Events: State changes, actions
 * 
 * @module domain
 */

// Agent Domain
export * from './agent/AgentState';
export * from './agent/AgentStateMachine';
export * from './agent/interfaces';

// Tool Domain
export * from './tool/interfaces';

// Common Types
export * from './common/types';
