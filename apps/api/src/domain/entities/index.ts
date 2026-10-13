/**
 * Domain Entities
 * 
 * Rich domain entities with business logic, validation, and state management.
 * Follow Domain-Driven Design (DDD) principles:
 * - Entities have identity (ID)
 * - Encapsulate business rules
 * - Enforce invariants
 * - Factory methods for creation
 * - toPrimitives/fromPrimitives for persistence mapping
 * 
 * @pattern Domain Entity (DDD), Factory Pattern
 */

export * from './Project';
export * from './Task';
export * from './Milestone';
