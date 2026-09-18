/**
 * AgentStateMachine
 * 
 * Manages agent state transitions with validation and history tracking.
 * Implements the State Pattern for agent lifecycle management.
 * 
 * Design Pattern: **State Pattern**
 * - Encapsulates state-specific behavior
 * - Validates state transitions
 * - Maintains state transition history
 * 
 * Responsibilities:
 * - Track current agent state
 * - Validate state transitions
 * - Execute state transitions
 * - Maintain transition history
 * - Provide state query methods
 * 
 * @module domain/agent/AgentStateMachine
 */

import { AgentState } from './AgentState';
import { StateTransition } from '../common/types';

/**
 * Agent State Machine
 * 
 * Core state management for agents.
 * Enforces valid state transitions and tracks history.
 * 
 * Valid State Transitions:
 * - IDLE → THINKING
 * - THINKING → ACTING | ERROR
 * - ACTING → COMPLETED | WAITING_APPROVAL | ERROR
 * - WAITING_APPROVAL → ACTING | COMPLETED | ERROR
 * - ERROR → IDLE (recovery)
 * - COMPLETED → IDLE (reuse)
 * 
 * @example
 * ```typescript
 * const sm = new AgentStateMachine();
 * sm.transitionTo(AgentState.THINKING);
 * sm.transitionTo(AgentState.ACTING);
 * sm.transitionTo(AgentState.COMPLETED);
 * ```
 */
export class AgentStateMachine {
  /** Current state */
  private currentState: AgentState;

  /** Transition history (oldest first) */
  private history: StateTransition[] = [];

  /** Valid state transition matrix */
  private readonly transitions = new Map<AgentState, AgentState[]>([
    [AgentState.IDLE, [AgentState.THINKING]],
    [AgentState.THINKING, [AgentState.ACTING, AgentState.ERROR]],
    [
      AgentState.ACTING,
      [AgentState.COMPLETED, AgentState.WAITING_APPROVAL, AgentState.ERROR],
    ],
    [
      AgentState.WAITING_APPROVAL,
      [AgentState.ACTING, AgentState.COMPLETED, AgentState.ERROR],
    ],
    [AgentState.ERROR, [AgentState.IDLE]],
    [AgentState.COMPLETED, [AgentState.IDLE]],
  ]);

  /**
   * Create a new state machine
   * 
   * @param initialState - Initial state (default: IDLE)
   */
  constructor(initialState: AgentState = AgentState.IDLE) {
    this.currentState = initialState;
  }

  /**
   * Get the current state
   * 
   * @returns Current agent state
   */
  getCurrentState(): AgentState {
    return this.currentState;
  }

  /**
   * Get the previous state
   * 
   * Returns the state before the most recent transition.
   * Returns null if no transitions have occurred.
   * 
   * @returns Previous state or null
   */
  getPreviousState(): AgentState | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1].from as AgentState;
  }

  /**
   * Check if a state transition is valid
   * 
   * @param targetState - State to transition to
   * @returns true if transition is valid, false otherwise
   */
  canTransitionTo(targetState: AgentState): boolean {
    // Cannot transition to same state
    if (this.currentState === targetState) {
      return false;
    }

    // Check if transition is in valid transitions map
    const validTransitions = this.transitions.get(this.currentState);
    if (!validTransitions) {
      return false;
    }

    return validTransitions.includes(targetState);
  }

  /**
   * Transition to a new state
   * 
   * Validates the transition, updates current state, and records in history.
   * 
   * @param targetState - State to transition to
   * @param reason - Optional reason for transition
   * @throws Error if transition is invalid
   * 
   * @example
   * ```typescript
   * sm.transitionTo(AgentState.THINKING, 'Starting analysis');
   * ```
   */
  transitionTo(targetState: AgentState, reason?: string): void {
    // Check if already in target state
    if (this.currentState === targetState) {
      throw new Error(
        `Agent is already in state ${targetState}. Cannot transition to same state.`
      );
    }

    // Validate transition
    if (!this.canTransitionTo(targetState)) {
      throw new Error(
        `Invalid state transition: ${this.currentState} → ${targetState}. ` +
        `Valid transitions from ${this.currentState}: ${this.getValidTransitions().join(', ')}`
      );
    }

    // Record transition in history
    const transition: StateTransition = {
      from: this.currentState,
      to: targetState,
      timestamp: new Date(),
      reason,
    };

    this.history.push(transition);

    // Update current state
    this.currentState = targetState;
  }

  /**
   * Get valid transitions from current state
   * 
   * @returns Array of valid target states
   */
  getValidTransitions(): AgentState[] {
    return this.transitions.get(this.currentState) || [];
  }

  /**
   * Get the transition history
   * 
   * Returns array of state transitions in chronological order (oldest first).
   * Each transition includes from/to states, timestamp, and optional reason.
   * 
   * @returns Array of state transitions
   */
  getHistory(): StateTransition[] {
    // Return copy to prevent external modification
    return [...this.history];
  }

  /**
   * Clear the transition history
   * 
   * Useful for resetting state machine or cleanup.
   * Does not affect current state.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get the total number of transitions
   * 
   * @returns Number of state transitions that have occurred
   */
  getTransitionCount(): number {
    return this.history.length;
  }

  /**
   * Get summary of state machine
   * 
   * Useful for debugging and logging.
   * 
   * @returns Summary object with current state, history length, and valid transitions
   */
  getSummary(): {
    currentState: AgentState;
    previousState: AgentState | null;
    transitionCount: number;
    validTransitions: AgentState[];
  } {
    return {
      currentState: this.currentState,
      previousState: this.getPreviousState(),
      transitionCount: this.getTransitionCount(),
      validTransitions: this.getValidTransitions(),
    };
  }

  /**
   * Reset state machine to initial state
   * 
   * Resets to IDLE and clears history.
   * Useful for reusing agent instances.
   */
  reset(): void {
    this.currentState = AgentState.IDLE;
    this.history = [];
  }
}
