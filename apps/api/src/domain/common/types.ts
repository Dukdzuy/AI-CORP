/**
 * Common Domain Types
 * 
 * Shared types used across domain boundaries.
 * 
 * @module domain/common/types
 */

import { AgentRole } from '@ai-corp/shared-types';

/**
 * Agent execution context
 * Contains all information needed for agent to perform its task
 */
export interface AgentContext {
  /** Unique identifier for this task */
  taskId: string;
  
  /** Project this task belongs to */
  projectId: string;
  
  /** Workflow run ID (if part of a workflow) */
  workflowRunId?: string;
  
  /** Task description */
  task: string;
  
  /** Project-level context data */
  projectContext: {
    goal?: string;
    description?: string;
    name?: string;
    [key: string]: unknown;
  };
  
  /** Relevant memories loaded for this task */
  relevantMemories: AgentMemory[];
  
  /** Tools available to the agent */
  availableTools: ToolDefinition[];
  
  /** Additional variables from workflow or previous steps */
  variables?: Record<string, unknown>;
}

/**
 * Result of agent thinking process
 */
export interface AgentThought {
  /** Reasoning text explaining the thought process */
  reasoning: string;
  
  /** Actions the agent plans to take */
  plannedActions: AgentAction[];
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Single action an agent plans to execute
 */
export interface AgentAction {
  /** Tool to use for this action */
  toolName: string;
  
  /** Parameters to pass to the tool */
  parameters: Record<string, unknown>;
  
  /** Explanation of why this action is needed */
  rationale: string;
}

/**
 * Result of agent action execution
 */
export interface AgentActionResult {
  /** Whether the action succeeded */
  success: boolean;
  
  /** Output from the action */
  output: unknown;
  
  /** Error message if failed */
  error?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Combined result of agent execution (thought + action)
 */
export interface AgentResult {
  /** The thinking process result */
  thought: AgentThought;
  
  /** The action execution result */
  action: AgentActionResult;
}

/**
 * Agent memory representation
 */
export interface AgentMemory {
  /** Unique memory ID */
  id: string;
  
  /** Agent role that created this memory */
  agentRole: AgentRole;
  
  /** Memory namespace (e.g., 'coding_conventions', 'strategy') */
  namespace: string;
  
  /** Memory content */
  content: string;
  
  /** Importance score (1-10) */
  importance: number;
  
  /** When the memory was created */
  timestamp: Date;
  
  /** Optional tags for categorization */
  tags?: string[];
  
  /** Project ID if memory is project-specific */
  projectId?: string;
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** JSON schema for parameters */
  parameters: Record<string, unknown>;
  
  /** Whether tool requires sandbox isolation */
  requiresSandbox?: boolean;
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Resource limits */
  resourceLimits?: ResourceLimits;
}

/**
 * Resource limits for tool execution
 */
export interface ResourceLimits {
  /** Maximum memory in MB */
  maxMemoryMB: number;
  
  /** Maximum CPU percentage */
  maxCPUPercent: number;
  
  /** Maximum disk space in MB */
  maxDiskMB: number;
  
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Whether execution succeeded */
  success: boolean;
  
  /** Output from the tool */
  output: string;
  
  /** Error message if failed */
  error?: string;
  
  /** Execution time in milliseconds */
  executionTimeMs: number;
  
  /** Resource usage */
  resourceUsage: {
    memoryMB: number;
    cpuPercent: number;
  };
}

/**
 * Tool parameters for execution
 */
export interface ToolParams {
  [key: string]: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Error messages if validation failed */
  errors: string[];
}

/**
 * State transition event
 */
export interface StateTransition {
  /** Previous state */
  from: string;
  
  /** New state */
  to: string;
  
  /** When the transition occurred */
  timestamp: Date;
  
  /** Optional reason for transition */
  reason?: string;
}

/**
 * Agent event types
 * Type aliases for event types used in Observer Pattern
 */

// Re-export event types from IAgentObserver interface
export type { 
  StateChangedEvent as AgentStateChangedEvent,
  ThinkingEvent as AgentThinkingStartedEvent,
  ActionEvent as AgentActionCompletedEvent,
} from '../agent/interfaces/IAgentObserver.interface';

/**
 * Event emitted when agent completes thinking
 */
export interface AgentThinkingCompletedEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  thought: AgentThought;
  timestamp: Date;
}

/**
 * Event emitted when agent starts an action
 */
export interface AgentActionStartedEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  actionType: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Event emitted when agent requests approval
 */
export interface AgentApprovalRequestedEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  approvalType: string;
  data: unknown;
  timestamp: Date;
}

/**
 * Event emitted when agent receives approval response
 */
export interface AgentApprovalReceivedEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  approved: boolean;
  reason?: string;
  timestamp: Date;
}

/**
 * Event emitted when agent encounters an error
 */
export interface AgentErrorEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId?: string;
  error: Error | string;
  timestamp: Date;
  context?: Record<string, unknown>;
}
