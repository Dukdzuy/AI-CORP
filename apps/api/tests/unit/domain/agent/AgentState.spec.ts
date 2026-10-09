/**
 * AgentState Enum Tests
 * 
 * Tests for the AgentState enumeration that defines valid agent lifecycle states.
 * Following TDD: This test is written BEFORE implementation.
 * 
 * @module tests/unit/domain/agent/AgentState.spec
 */

import { AgentState } from '../../../../src/domain/agent/AgentState';

describe('AgentState Enum', () => {
  describe('State Values', () => {
    it('should define IDLE state', () => {
      expect(AgentState.IDLE).toBeDefined();
      expect(AgentState.IDLE).toBe('IDLE');
    });

    it('should define THINKING state', () => {
      expect(AgentState.THINKING).toBeDefined();
      expect(AgentState.THINKING).toBe('THINKING');
    });

    it('should define ACTING state', () => {
      expect(AgentState.ACTING).toBeDefined();
      expect(AgentState.ACTING).toBe('ACTING');
    });

    it('should define WAITING_APPROVAL state', () => {
      expect(AgentState.WAITING_APPROVAL).toBeDefined();
      expect(AgentState.WAITING_APPROVAL).toBe('WAITING_APPROVAL');
    });

    it('should define ERROR state', () => {
      expect(AgentState.ERROR).toBeDefined();
      expect(AgentState.ERROR).toBe('ERROR');
    });

    it('should define COMPLETED state', () => {
      expect(AgentState.COMPLETED).toBeDefined();
      expect(AgentState.COMPLETED).toBe('COMPLETED');
    });
  });

  describe('All States', () => {
    it('should have exactly 6 states', () => {
      const states = Object.values(AgentState);
      expect(states).toHaveLength(6);
    });

    it('should contain all expected states', () => {
      const states = Object.values(AgentState);
      expect(states).toContain('IDLE');
      expect(states).toContain('THINKING');
      expect(states).toContain('ACTING');
      expect(states).toContain('WAITING_APPROVAL');
      expect(states).toContain('ERROR');
      expect(states).toContain('COMPLETED');
    });
  });

  describe('Type Safety', () => {
    it('should allow assignment of valid state', () => {
      const state: AgentState = AgentState.THINKING;
      expect(state).toBe('THINKING');
    });

    it('should be usable in conditional logic', () => {
      const state: AgentState = AgentState.ACTING;
      
      if (state === AgentState.ACTING) {
        expect(true).toBe(true);
      } else {
        fail('State comparison failed');
      }
    });
  });
});
