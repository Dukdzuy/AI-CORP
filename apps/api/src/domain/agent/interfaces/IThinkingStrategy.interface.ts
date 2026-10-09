/**
 * IThinkingStrategy Interface
 * 
 * Strategy interface for agent thinking behavior.
 * Implements the Strategy Pattern to allow runtime swapping of thinking algorithms.
 * 
 * Design Pattern: **Strategy Pattern**
 * - Context: Agent
 * - Strategy: IThinkingStrategy
 * - Concrete Strategies: CeoThinkingStrategy, DevThinkingStrategy, etc.
 * 
 * Benefits:
 * - Agent behavior can be changed at runtime
 * - Multiple thinking strategies for same agent role
 * - Easy to test and extend
 * - Follows Open/Closed Principle
 * 
 * @module domain/agent/interfaces/IThinkingStrategy
 */

import { AgentContext, AgentThought } from '../../common/types';

/**
 * Thinking Strategy Interface
 * 
 * Defines how an agent analyzes a task and formulates a plan.
 * Each agent role can have different thinking strategies.
 * 
 * Responsibilities:
 * - Analyze the task context
 * - Load relevant memories
 * - Reason about the problem
 * - Formulate a plan of actions
 * - Assess confidence level
 */
export interface IThinkingStrategy {
  /**
   * Perform thinking process
   * 
   * Analyzes the context and generates a thought with planned actions.
   * This is the "think" phase of the agent's execution cycle.
   * 
   * Implementation Guidelines:
   * 1. Load relevant memories based on context
   * 2. Analyze the task requirements
   * 3. Call LLM for reasoning (if needed)
   * 4. Extract planned actions from reasoning
   * 5. Calculate confidence score
   * 
   * @param context - Agent execution context
   * @returns Promise resolving to agent thought
   * @throws Error if thinking process fails
   * 
   * @example
   * ```typescript
   * const strategy = new CeoThinkingStrategy(memoryService, llmProvider);
   * const thought = await strategy.think(context);
   * // thought.reasoning: "Based on the project goal..."
   * // thought.plannedActions: [{ toolName: 'create_milestone', ... }]
   * // thought.confidence: 0.85
   * ```
   */
  think(context: AgentContext): Promise<AgentThought>;
}
