/**
 * ITool Interface
 * 
 * Core interface that all tools must implement.
 * Defines the contract for tool behavior, validation, and execution.
 * 
 * Design Principles Applied:
 * - **Interface Segregation**: Focused interface for tools
 * - **Dependency Inversion**: Tools depend on abstraction
 * - **Template Method**: execute() enforces validation before execution
 * 
 * @module domain/tool/interfaces/ITool
 */

import { ToolDefinition, ToolParams, ToolResult, ValidationResult } from '../../common/types';

/**
 * Tool Interface
 * 
 * Defines the contract that all tools must implement.
 * Tools are executable units that perform specific tasks (file I/O, tests, etc.)
 */
export interface ITool {
  /**
   * Get the tool name
   * 
   * @returns Tool name (unique identifier)
   */
  getName(): string;

  /**
   * Get the tool description
   * 
   * @returns Human-readable description of what the tool does
   */
  getDescription(): string;

  /**
   * Get the tool parameter schema
   * 
   * @returns JSON schema defining required and optional parameters
   */
  getParameters(): Record<string, unknown>;

  /**
   * Validate tool parameters
   * 
   * Checks if provided parameters match the schema.
   * Should be called before execute().
   * 
   * @param params - Parameters to validate
   * @returns Validation result with errors if invalid
   */
  validate(params: ToolParams): ValidationResult;

  /**
   * Execute the tool with given parameters
   * 
   * Template Method Pattern:
   * 1. Validate parameters
   * 2. Execute tool logic (implemented by concrete tool)
   * 3. Return result
   * 
   * @param params - Tool parameters
   * @returns Promise resolving to tool result
   * @throws Error if validation fails or execution error occurs
   */
  execute(params: ToolParams): Promise<ToolResult>;
}
