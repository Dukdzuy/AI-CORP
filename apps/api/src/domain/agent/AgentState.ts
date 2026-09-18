/**
 * AgentState Enumeration
 * 
 * Defines the valid states in an agent's lifecycle.
 * Used by AgentStateMachine to manage state transitions.
 * 
 * State Transitions (valid flows):
 * - IDLE → THINKING
 * - THINKING → ACTING | ERROR
 * - ACTING → COMPLETED | WAITING_APPROVAL | ERROR
 * - WAITING_APPROVAL → ACTING | COMPLETED | ERROR
 * - ERROR → IDLE (after recovery)
 * - COMPLETED → IDLE (for reuse)
 * 
 * @module domain/agent/AgentState
 */

export enum AgentState {
  /**
   * Agent is idle, waiting for work
   */
  IDLE = 'IDLE',

  /**
   * Agent is analyzing the problem and planning actions
   */
  THINKING = 'THINKING',

  /**
   * Agent is executing actions (calling tools, LLMs, etc.)
   */
  ACTING = 'ACTING',

  /**
   * Agent is waiting for human approval before proceeding
   */
  WAITING_APPROVAL = 'WAITING_APPROVAL',

  /**
   * Agent encountered an error during execution
   */
  ERROR = 'ERROR',

  /**
   * Agent has successfully completed its task
   */
  COMPLETED = 'COMPLETED',
}
