/**
 * Agent Domain Interfaces
 * 
 * Central export point for all agent-related interfaces.
 * 
 * @module domain/agent/interfaces
 */

export * from './IAgent.interface';
export * from './IAgentObserver.interface';
export * from './IThinkingStrategy.interface';
export * from './IActionStrategy.interface';
// IAgentRepository lives in domain/repositories (single persistence contract for agents)
