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
 */
export interface IAgentObserver {
  /**
   * Called when agent state changes
   * 
   * @param event - State change event details
   */
  onStateChanged(event: StateChangedEvent): void;

  /**
   * Called when agent starts thinking
   * 
   * @param event - Thinking event details
   */
  onThinkingStarted(event: ThinkingEvent): void;

  /**
   * Called when agent completes an action
   * 
   * @param event - Action event details
   */
  onActionCompleted(event: ActionEvent): void;
}
