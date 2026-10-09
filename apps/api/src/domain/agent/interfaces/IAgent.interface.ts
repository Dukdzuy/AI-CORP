/**
 * IAgent Interface
 * 
 * Core interface that all agent implementations must follow.
 * Defines the contract for agent behavior, state management, and event handling.
 * 
 * Design Principles Applied:
 * - **Interface Segregation**: Small, focused interface
 * - **Dependency Inversion**: Depend on abstraction, not concretion
 * - **Open/Closed**: Open for extension (via implementations), closed for modification
 * 
 * @module domain/agent/interfaces/IAgent
 */

import { AgentRole } from '@ai-corp/shared-types';
import { AgentState } from '../AgentState';
import { AgentContext, AgentResult } from '../../common/types';
import { IAgentObserver } from './IAgentObserver.interface';

/**
 * Agent Interface
 * 
 * Defines the core contract that all agents must implement.
 * Agents are stateful entities that can think, act, and emit events.
 */
export interface IAgent {
  /**
   * Get the unique identifier for this agent instance
   * 
   * @returns Unique agent ID
   */
  getId(): string;

  /**
   * Get the role of this agent
   * 
   * @returns Agent role (CEO, PM, DEV, QA, MARKETING)
   */
  getRole(): AgentRole;

  /**
   * Get the current state of this agent
   * 
   * @returns Current agent state
   */
  getState(): AgentState;

  /**
   * Execute the agent's think-act cycle
   * 
   * This is the main entry point for agent execution.
   * The agent will:
   * 1. Transition to THINKING state
   * 2. Analyze the context and formulate a plan (think)
   * 3. Transition to ACTING state
   * 4. Execute the planned actions (act)
   * 5. Transition to COMPLETED or ERROR state
   * 
   * @param context - Execution context with task details
   * @returns Promise resolving to agent result (thought + action)
   * @throws Error if execution fails
   */
  execute(context: AgentContext): Promise<AgentResult>;

  /**
   * Add an observer to listen to agent events
   * 
   * Observers will be notified of:
   * - State changes
   * - Thinking started
   * - Actions completed
   * 
   * @param observer - Observer to add
   */
  addEventListener(observer: IAgentObserver): void;

  /**
   * Remove an observer
   * 
   * @param observer - Observer to remove
   */
  removeEventListener(observer: IAgentObserver): void;
}
