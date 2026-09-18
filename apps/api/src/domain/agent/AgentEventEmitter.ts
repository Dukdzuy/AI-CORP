/**
 * AgentEventEmitter - Observer Pattern Implementation
 * 
 * Manages observer registration and event emission for agent lifecycle events.
 * Implements the classic Observer Pattern with IAgentObserver interface.
 * 
 * Design Pattern: Observer Pattern (Gang of Four)
 * SOLID Principles:
 * - SRP: Focused solely on observer management and event emission
 * - OCP: Open for extension (new observers), closed for modification
 * - LSP: Can be substituted where observer management is needed
 * - ISP: Uses focused IAgentObserver interface
 * - DIP: Depends on IAgentObserver abstraction, not concrete classes
 */

import {
  IAgentObserver,
  StateChangedEvent,
  ThinkingEvent,
  ThinkingCompletedEvent,
  ActionStartedEvent,
  ActionEvent,
  ApprovalRequestedEvent,
  ApprovalReceivedEvent,
  ErrorEvent,
} from './interfaces/IAgentObserver.interface';

/**
 * AgentEventEmitter - Core observer management for agent lifecycle events
 * 
 * Features:
 * - Observer registration and removal
 * - Type-safe event emission through IAgentObserver interface
 * - Multiple observers support
 * - Error isolation (one observer error doesn't affect others)
 * - Duplicate observer prevention
 * - Graceful error handling
 * 
 * @example
 * ```typescript
 * const emitter = new AgentEventEmitter();
 * 
 * // Add observer
 * const observer: IAgentObserver = {
 *   onStateChanged: async (event) => {
 *     console.log(`State: ${event.previousState} -> ${event.currentState}`);
 *   },
 *   // ... other observer methods
 * };
 * emitter.addObserver(observer);
 * 
 * // Emit event
 * emitter.emitStateChanged({
 *   agentId: 'agent-1',
 *   agentRole: AgentRole.CEO,
 *   previousState: AgentState.IDLE,
 *   currentState: AgentState.THINKING,
 *   timestamp: new Date(),
 * });
 * ```
 */
export class AgentEventEmitter {
  /**
   * Internal storage for registered observers
   * Uses Set to automatically prevent duplicates
   */
  private observers: Set<IAgentObserver> = new Set();

  /**
   * Add an observer to receive event notifications
   * 
   * @param observer - Observer implementing IAgentObserver interface
   * @returns This emitter instance for method chaining
   * 
   * Note: Duplicate observers are automatically prevented by Set
   */
  addObserver(observer: IAgentObserver): this {
    this.observers.add(observer);
    return this;
  }

  /**
   * Remove an observer from receiving event notifications
   * 
   * @param observer - Observer to remove
   * @returns This emitter instance for method chaining
   * 
   * Note: Removing non-existent observer is a no-op (graceful)
   */
  removeObserver(observer: IAgentObserver): this {
    this.observers.delete(observer);
    return this;
  }

  /**
   * Remove all registered observers
   * 
   * Useful for cleanup or reset scenarios
   */
  removeAllObservers(): void {
    this.observers.clear();
  }

  /**
   * Get the current count of registered observers
   * 
   * @returns Number of registered observers
   */
  getObserverCount(): number {
    return this.observers.size;
  }

  /**
   * Check if a specific observer is registered
   * 
   * @param observer - Observer to check
   * @returns True if observer is registered
   */
  hasObserver(observer: IAgentObserver): boolean {
    return this.observers.has(observer);
  }

  /**
   * Emit state changed event to all observers
   * 
   * Features:
   * - Calls observers in registration order
   * - Isolates errors (one observer error doesn't stop others)
   * - Continues execution even if some observers throw
   * 
   * @param event - State change event data
   */
  emitStateChanged(event: StateChangedEvent): void {
    for (const observer of this.observers) {
      try {
        // Call observer method, catching any errors
        void observer.onStateChanged?.(event);
      } catch (error) {
        // Silently catch errors to prevent one observer from breaking others
        // In production, this might log to monitoring system
        console.error('Observer error in onStateChanged:', error);
      }
    }
  }

  /**
   * Emit thinking started event to all observers
   * 
   * @param event - Thinking started event data
   */
  emitThinkingStarted(event: ThinkingEvent): void {
    for (const observer of this.observers) {
      try {
        void observer.onThinkingStarted?.(event);
      } catch (error) {
        console.error('Observer error in onThinkingStarted:', error);
      }
    }
  }

  /**
   * Emit thinking completed event to all observers
   * 
   * @param event - Thinking completed event data
   */
  emitThinkingCompleted(event: ThinkingCompletedEvent): void {
    for (const observer of this.observers) {
      try {
        void observer.onThinkingCompleted?.(event);
      } catch (error) {
        console.error('Observer error in onThinkingCompleted:', error);
      }
    }
  }

  /**
   * Emit action started event to all observers
   * 
   * @param event - Action started event data
   */
  emitActionStarted(event: ActionStartedEvent): void {
    for (const observer of this.observers) {
      try {
        void observer.onActionStarted?.(event);
      } catch (error) {
        console.error('Observer error in onActionStarted:', error);
      }
    }
  }

  /**
   * Emit action completed event to all observers
   * 
   * @param event - Action completed event data
   */
  emitActionCompleted(event: ActionEvent): void {
    for (const observer of this.observers) {
      try {
        void observer.onActionCompleted?.(event);
      } catch (error) {
        console.error('Observer error in onActionCompleted:', error);
      }
    }
  }

  /**
   * Emit approval requested event to all observers
   * 
   * @param event - Approval requested event data
   */
  emitApprovalRequested(event: ApprovalRequestedEvent): void {
    for (const observer of this.observers) {
      try {
        void observer.onApprovalRequested?.(event);
      } catch (error) {
        console.error('Observer error in onApprovalRequested:', error);
      }
    }
  }

  /**
   * Emit approval received event to all observers
   * 
   * @param event - Approval received event data
   */
  emitApprovalReceived(event: ApprovalReceivedEvent): void {
    for (const observer of this.observers) {
      try {
        void observer.onApprovalReceived?.(event);
      } catch (error) {
        console.error('Observer error in onApprovalReceived:', error);
      }
    }
  }

  /**
   * Emit error event to all observers
   * 
   * @param event - Error event data
   */
  emitError(event: ErrorEvent): void {
    for (const observer of this.observers) {
      try {
        void observer.onError?.(event);
      } catch (error) {
        // Extra care for error events - don't emit another error event
        console.error('Observer error in onError:', error);
      }
    }
  }
}
