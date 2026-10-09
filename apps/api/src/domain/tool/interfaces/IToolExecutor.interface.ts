/**
 * IToolExecutor Interface
 * 
 * Interface for executing tools in isolated environments.
 * Handles sandbox execution, resource management, and security.
 * 
 * Design Pattern: **Facade Pattern**
 * - Simplifies complex tool execution logic
 * - Hides sandbox details from consumers
 * 
 * @module domain/tool/interfaces/IToolExecutor
 */

import { ITool } from './ITool.interface';
import { ToolParams, ToolResult } from '../../common/types';

/**
 * Tool Executor Interface
 * 
 * Responsible for executing tools in appropriate environments.
 * Handles sandbox isolation, security, and resource limits.
 */
export interface IToolExecutor {
  /**
   * Execute a tool with given parameters
   * 
   * Determines if tool requires sandbox isolation.
   * If yes, executes in Docker container with resource limits.
   * If no, executes directly.
   * 
   * @param tool - Tool to execute
   * @param params - Tool parameters
   * @returns Promise resolving to tool result
   * @throws Error if execution fails
   */
  execute(tool: ITool, params: ToolParams): Promise<ToolResult>;
}
