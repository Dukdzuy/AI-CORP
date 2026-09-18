/**
 * AgentStateMachine Tests
 * 
 * Tests for the AgentStateMachine class that manages agent state transitions.
 * Following TDD: These tests are written BEFORE implementation.
 * 
 * Tests cover:
 * - Valid state transitions
 * - Invalid transition prevention
 * - State history tracking
 * - Initial state setup
 * - Transition validation
 * 
 * @module tests/unit/domain/agent/AgentStateMachine.spec
 */

import { AgentStateMachine } from '../../../../src/domain/agent/AgentStateMachine';
import { AgentState } from '../../../../src/domain/agent/AgentState';

describe('AgentStateMachine', () => {
  describe('Initialization', () => {
    it('should start in IDLE state by default', () => {
      const stateMachine = new AgentStateMachine();
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.IDLE);
    });

    it('should allow custom initial state', () => {
      const stateMachine = new AgentStateMachine(AgentState.THINKING);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.THINKING);
    });

    it('should have empty history initially', () => {
      const stateMachine = new AgentStateMachine();
      
      const history = stateMachine.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Valid State Transitions', () => {
    it('should allow IDLE → THINKING', () => {
      const stateMachine = new AgentStateMachine();
      
      expect(stateMachine.canTransitionTo(AgentState.THINKING)).toBe(true);
      stateMachine.transitionTo(AgentState.THINKING);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.THINKING);
    });

    it('should allow THINKING → ACTING', () => {
      const stateMachine = new AgentStateMachine(AgentState.THINKING);
      
      expect(stateMachine.canTransitionTo(AgentState.ACTING)).toBe(true);
      stateMachine.transitionTo(AgentState.ACTING);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.ACTING);
    });

    it('should allow THINKING → ERROR', () => {
      const stateMachine = new AgentStateMachine(AgentState.THINKING);
      
      expect(stateMachine.canTransitionTo(AgentState.ERROR)).toBe(true);
      stateMachine.transitionTo(AgentState.ERROR);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.ERROR);
    });

    it('should allow ACTING → COMPLETED', () => {
      const stateMachine = new AgentStateMachine(AgentState.ACTING);
      
      expect(stateMachine.canTransitionTo(AgentState.COMPLETED)).toBe(true);
      stateMachine.transitionTo(AgentState.COMPLETED);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.COMPLETED);
    });

    it('should allow ACTING → WAITING_APPROVAL', () => {
      const stateMachine = new AgentStateMachine(AgentState.ACTING);
      
      expect(stateMachine.canTransitionTo(AgentState.WAITING_APPROVAL)).toBe(true);
      stateMachine.transitionTo(AgentState.WAITING_APPROVAL);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.WAITING_APPROVAL);
    });

    it('should allow ACTING → ERROR', () => {
      const stateMachine = new AgentStateMachine(AgentState.ACTING);
      
      expect(stateMachine.canTransitionTo(AgentState.ERROR)).toBe(true);
      stateMachine.transitionTo(AgentState.ERROR);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.ERROR);
    });

    it('should allow WAITING_APPROVAL → ACTING', () => {
      const stateMachine = new AgentStateMachine(AgentState.WAITING_APPROVAL);
      
      expect(stateMachine.canTransitionTo(AgentState.ACTING)).toBe(true);
      stateMachine.transitionTo(AgentState.ACTING);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.ACTING);
    });

    it('should allow WAITING_APPROVAL → COMPLETED', () => {
      const stateMachine = new AgentStateMachine(AgentState.WAITING_APPROVAL);
      
      expect(stateMachine.canTransitionTo(AgentState.COMPLETED)).toBe(true);
      stateMachine.transitionTo(AgentState.COMPLETED);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.COMPLETED);
    });

    it('should allow ERROR → IDLE (recovery)', () => {
      const stateMachine = new AgentStateMachine(AgentState.ERROR);
      
      expect(stateMachine.canTransitionTo(AgentState.IDLE)).toBe(true);
      stateMachine.transitionTo(AgentState.IDLE);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.IDLE);
    });

    it('should allow COMPLETED → IDLE (reuse)', () => {
      const stateMachine = new AgentStateMachine(AgentState.COMPLETED);
      
      expect(stateMachine.canTransitionTo(AgentState.IDLE)).toBe(true);
      stateMachine.transitionTo(AgentState.IDLE);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.IDLE);
    });
  });

  describe('Invalid State Transitions', () => {
    it('should reject IDLE → ACTING (must think first)', () => {
      const stateMachine = new AgentStateMachine();
      
      expect(stateMachine.canTransitionTo(AgentState.ACTING)).toBe(false);
      expect(() => stateMachine.transitionTo(AgentState.ACTING)).toThrow(
        /Invalid state transition/
      );
    });

    it('should reject IDLE → COMPLETED', () => {
      const stateMachine = new AgentStateMachine();
      
      expect(stateMachine.canTransitionTo(AgentState.COMPLETED)).toBe(false);
      expect(() => stateMachine.transitionTo(AgentState.COMPLETED)).toThrow();
    });

    it('should reject THINKING → COMPLETED (must act first)', () => {
      const stateMachine = new AgentStateMachine(AgentState.THINKING);
      
      expect(stateMachine.canTransitionTo(AgentState.COMPLETED)).toBe(false);
      expect(() => stateMachine.transitionTo(AgentState.COMPLETED)).toThrow();
    });

    it('should reject THINKING → WAITING_APPROVAL', () => {
      const stateMachine = new AgentStateMachine(AgentState.THINKING);
      
      expect(stateMachine.canTransitionTo(AgentState.WAITING_APPROVAL)).toBe(false);
      expect(() => stateMachine.transitionTo(AgentState.WAITING_APPROVAL)).toThrow();
    });

    it('should reject COMPLETED → THINKING', () => {
      const stateMachine = new AgentStateMachine(AgentState.COMPLETED);
      
      expect(stateMachine.canTransitionTo(AgentState.THINKING)).toBe(false);
      expect(() => stateMachine.transitionTo(AgentState.THINKING)).toThrow();
    });

    it('should reject transition to same state', () => {
      const stateMachine = new AgentStateMachine();
      
      expect(stateMachine.canTransitionTo(AgentState.IDLE)).toBe(false);
      expect(() => stateMachine.transitionTo(AgentState.IDLE)).toThrow(
        /already in state/
      );
    });
  });

  describe('State History Tracking', () => {
    it('should track state transitions in history', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ACTING);
      
      const history = stateMachine.getHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe(AgentState.IDLE);
      expect(history[0].to).toBe(AgentState.THINKING);
      expect(history[1].from).toBe(AgentState.THINKING);
      expect(history[1].to).toBe(AgentState.ACTING);
    });

    it('should include timestamps in history', () => {
      const stateMachine = new AgentStateMachine();
      const before = new Date();
      
      stateMachine.transitionTo(AgentState.THINKING);
      
      const after = new Date();
      const history = stateMachine.getHistory();
      
      expect(history[0].timestamp).toBeInstanceOf(Date);
      expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(history[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include optional reason in history', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING, 'Starting analysis');
      
      const history = stateMachine.getHistory();
      expect(history[0].reason).toBe('Starting analysis');
    });

    it('should maintain history order (oldest first)', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ACTING);
      stateMachine.transitionTo(AgentState.COMPLETED);
      
      const history = stateMachine.getHistory();
      
      expect(history[0].to).toBe(AgentState.THINKING);
      expect(history[1].to).toBe(AgentState.ACTING);
      expect(history[2].to).toBe(AgentState.COMPLETED);
    });

    it('should allow clearing history', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ACTING);
      
      expect(stateMachine.getHistory()).toHaveLength(2);
      
      stateMachine.clearHistory();
      
      expect(stateMachine.getHistory()).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid transitions', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ACTING);
      stateMachine.transitionTo(AgentState.COMPLETED);
      stateMachine.transitionTo(AgentState.IDLE);
      stateMachine.transitionTo(AgentState.THINKING);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.THINKING);
      expect(stateMachine.getHistory()).toHaveLength(5);
    });

    it('should handle error recovery flow', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ERROR, 'LLM call failed');
      stateMachine.transitionTo(AgentState.IDLE, 'Recovered from error');
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.IDLE);
      
      const history = stateMachine.getHistory();
      expect(history[1].reason).toBe('LLM call failed');
      expect(history[2].reason).toBe('Recovered from error');
    });

    it('should handle approval flow', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ACTING);
      stateMachine.transitionTo(AgentState.WAITING_APPROVAL);
      stateMachine.transitionTo(AgentState.ACTING, 'Approved, continuing');
      stateMachine.transitionTo(AgentState.COMPLETED);
      
      expect(stateMachine.getCurrentState()).toBe(AgentState.COMPLETED);
    });
  });

  describe('getPreviousState', () => {
    it('should return null if no history', () => {
      const stateMachine = new AgentStateMachine();
      expect(stateMachine.getPreviousState()).toBeNull();
    });

    it('should return previous state after transition', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      
      expect(stateMachine.getPreviousState()).toBe(AgentState.IDLE);
    });

    it('should return correct previous state after multiple transitions', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ACTING);
      
      expect(stateMachine.getPreviousState()).toBe(AgentState.THINKING);
    });
  });

  describe('getTransitionCount', () => {
    it('should return 0 initially', () => {
      const stateMachine = new AgentStateMachine();
      expect(stateMachine.getTransitionCount()).toBe(0);
    });

    it('should count transitions correctly', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      expect(stateMachine.getTransitionCount()).toBe(1);
      
      stateMachine.transitionTo(AgentState.ACTING);
      expect(stateMachine.getTransitionCount()).toBe(2);
    });

    it('should reset count when history cleared', () => {
      const stateMachine = new AgentStateMachine();
      
      stateMachine.transitionTo(AgentState.THINKING);
      stateMachine.transitionTo(AgentState.ACTING);
      stateMachine.clearHistory();
      
      expect(stateMachine.getTransitionCount()).toBe(0);
    });
  });
});
