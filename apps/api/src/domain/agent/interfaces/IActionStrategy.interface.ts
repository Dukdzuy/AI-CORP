/**
 * IActionStrategy Interface
 * 
 * Strategy interface for agent action execution behavior.
 * Implements the Strategy Pattern to allow runtime swapping of action algorithms.
 * 
 * Design Pattern: **Strategy Pattern**
 * - Context: Agent
 * - Strategy: IActionStrategy
 * - Concrete Strategies: CeoActionStrategy, DevActionStrategy, etc.
 * 
 * Benefits:
 * - Agent actions can be changed at runtime
 * - Multiple action strategies for same agent role
 * - Easy to test and extend
 * - Follows Open/Closed Principle
 * 
 * @module domain/agent/interfaces/IActionStrategy
 */

import { AgentContext, AgentThought, AgentActionResult } from '../../common/types';

/**
 * Action Strategy Interface
 * 
 * Defines how an agent executes planned actions.
 * Each agent role can have different action strategies.
 * 
 * Responsibilities:
 * - Execute the planned actions from thinking phase
 * - Interact with tools (via ToolExecutor)
 * - Call LLM for generation tasks (if needed)
 * - Handle errors and retries
 * - Return execution results
 */
export interface IActionStrategy {
  /**
   * Execute actions based on thought
   * 
   * Takes the thought from thinking phase and executes the planned actions.
   * This is the "act" phase of the agent's execution cycle.
   * 
   * Implementation Guidelines:
   * 1. Iterate through planned actions
   * 2. Execute each action (via tools or direct LLM calls)
   * 3. Collect results
   * 4. Handle errors gracefully
   * 5. Return combined result
   * 
   * @param context - Agent execution context
   * @param thought - Result from thinking phase
   * @returns Promise resolving to action result
   * @throws Error if action execution fails critically
   * 
   * @example
   * ```typescript
   * const strategy = new DevActionStrategy(toolExecutor, llmProvider);
   * const result = await strategy.act(context, thought);
   * // result.success: true
   * // result.output: { filesWritten: ['src/index.ts'], code: '...' }
   * ```
   */
  act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult>;
}
