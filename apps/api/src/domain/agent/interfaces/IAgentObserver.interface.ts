/**
 * IAgentObserver Interface
 * 
 * Observer interface for listening to agent events.
 * Implements the Observer Pattern for decoupled event handling.
 * 
 * Design Pattern: **Observer Pattern**
 * - Subject: Agent
 * - Observer: IAgentObserver implementations
 * - Benefit: Decoupled event handling, multiple observers can subscribe
 * 
 * @module domain/agent/interfaces/IAgentObserver
 */

import { AgentState } from '../AgentState';
import { AgentThought, AgentActionResult } from '../../common/types';
import { AgentRole } from '@ai-corp/shared-types';

/**
 * Event emitted when agent state changes
 */
export interface StateChangedEvent {
  /** Agent that changed state */
  agentId: string;
  
  /** Agent role */
  agentRole: AgentRole;
  
  /** Previous state */
  previousState: AgentState;
  
  /** New state */
  currentState: AgentState;
  
  /** When the change occurred */
  timestamp: Date;
  
  /** Optional reason for change */
  reason?: string;
}

/**
 * Event emitted when agent starts thinking
 */
export interface ThinkingEvent {
  /** Agent that is thinking */
  agentId: string;
  
  /** Agent role */
  agentRole: AgentRole;
  
  /** Task ID being processed */
  taskId: string;
  
  /** Thinking message */
  message: string;
  
  /** When thinking started */
  timestamp: Date;
}

/**
 * Event emitted when agent completes thinking
 */
export interface ThinkingCompletedEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  thought: AgentThought;
  timestamp: Date;
}

/**
 * Event emitted when agent completes an action
 */
export interface ActionEvent {
  /** Agent that completed action */
  agentId: string;
  
  /** Agent role */
  agentRole: AgentRole;
  
  /** Task ID */
  taskId: string;
  
  /** Type of action */
  actionType: string;
  
  /** Tool used */
  toolName: string;
  
  /** Action parameters */
  parameters: Record<string, unknown>;
  
  /** Action result */
  result?: AgentActionResult;
  
  /** When action completed */
  timestamp: Date;
}

/**
 * Event emitted when agent starts an action
 */
export interface ActionStartedEvent {
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
export interface ApprovalRequestedEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  approvalType?: string;
  data?: unknown;
  timestamp: Date;
}

/**
 * Event emitted when agent receives approval response
 */
export interface ApprovalReceivedEvent {
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
export interface ErrorEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId?: string;
  error: Error | string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

/**
 * Agent Observer Interface
 * 
 * Observers implement this interface to receive notifications from agents.
 * Multiple observers can subscribe to a single agent.
 * 
 * Common use cases:
 * - WebSocket: Broadcast events to frontend
 * - Metrics: Track agent performance
 * - Memory: Store observations for learning
 * - Logging: Audit trail
 * 
 * Note: All methods are optional to allow partial implementation
 */
export interface IAgentObserver {
  /**
   * Called when agent state changes
   * 
   * @param event - State change event details
   */
  onStateChanged?(event: StateChangedEvent): void;

  /**
   * Called when agent starts thinking
   * 
   * @param event - Thinking event details
   */
  onThinkingStarted?(event: ThinkingEvent): void;

  /**
   * Called when agent completes thinking
   * 
   * @param event - Thinking completion event details
   */
  onThinkingCompleted?(event: ThinkingCompletedEvent): void;

  /**
   * Called when agent starts an action
   * 
   * @param event - Action event details
   */
  onActionStarted?(event: ActionStartedEvent): void;

  /**
   * Called when agent completes an action
   * 
   * @param event - Action event details
   */
  onActionCompleted?(event: ActionEvent): void;

  /**
   * Called when agent requests approval
   * 
   * @param event - Approval request event details
   */
  onApprovalRequested?(event: ApprovalRequestedEvent): void;

  /**
   * Called when agent receives approval response
   * 
   * @param event - Approval response event details
   */
  onApprovalReceived?(event: ApprovalReceivedEvent): void;

  /**
   * Called when agent encounters an error
   * 
   * @param event - Error event details
   */
  onError?(event: ErrorEvent): void;
}

