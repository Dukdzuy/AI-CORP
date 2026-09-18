/**
 * AgentEventEmitter Tests
 * 
 * Tests for the AgentEventEmitter class that implements Observer Pattern.
 * Following TDD: These tests are written BEFORE implementation.
 * 
 * Tests cover:
 * - Observer registration and removal
 * - Event emission to observers
 * - Multiple observers handling
 * - Event type filtering
 * - Error handling in observers
 * 
 * @module tests/unit/domain/agent/AgentEventEmitter.spec
 */

import { AgentEventEmitter } from '../../../../src/domain/agent/AgentEventEmitter';
import { AgentState } from '../../../../src/domain/agent/AgentState';
import { AgentRole } from '@ai-corp/shared-types';
import { createMockAgentObserver } from '../../../utils';

describe('AgentEventEmitter', () => {
  describe('Observer Management', () => {
    it('should start with no observers', () => {
      const emitter = new AgentEventEmitter();
      
      expect(emitter.getObserverCount()).toBe(0);
    });

    it('should add an observer', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      
      expect(emitter.getObserverCount()).toBe(1);
    });

    it('should add multiple observers', () => {
      const emitter = new AgentEventEmitter();
      const observer1 = createMockAgentObserver();
      const observer2 = createMockAgentObserver();
      const observer3 = createMockAgentObserver();
      
      emitter.addObserver(observer1);
      emitter.addObserver(observer2);
      emitter.addObserver(observer3);
      
      expect(emitter.getObserverCount()).toBe(3);
    });

    it('should not add duplicate observers', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      emitter.addObserver(observer); // Try to add same observer again
      
      expect(emitter.getObserverCount()).toBe(1);
    });

    it('should remove an observer', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      emitter.removeObserver(observer);
      
      expect(emitter.getObserverCount()).toBe(0);
    });

    it('should handle removing non-existent observer gracefully', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      expect(() => emitter.removeObserver(observer)).not.toThrow();
    });

    it('should remove all observers', () => {
      const emitter = new AgentEventEmitter();
      const observer1 = createMockAgentObserver();
      const observer2 = createMockAgentObserver();
      
      emitter.addObserver(observer1);
      emitter.addObserver(observer2);
      emitter.removeAllObservers();
      
      expect(emitter.getObserverCount()).toBe(0);
    });
  });

  describe('StateChanged Event Emission', () => {
    it('should emit stateChanged event to observer', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      
      emitter.emitStateChanged({
        agentId: 'agent-123',
        agentRole: AgentRole.CEO,
        previousState: AgentState.IDLE,
        currentState: AgentState.THINKING,
        timestamp: new Date(),
      });
      
      expect(observer.onStateChanged).toHaveBeenCalledTimes(1);
      expect(observer.onStateChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
          previousState: AgentState.IDLE,
          currentState: AgentState.THINKING,
        })
      );
    });

    it('should emit to all observers', () => {
      const emitter = new AgentEventEmitter();
      const observer1 = createMockAgentObserver();
      const observer2 = createMockAgentObserver();
      const observer3 = createMockAgentObserver();
      
      emitter.addObserver(observer1);
      emitter.addObserver(observer2);
      emitter.addObserver(observer3);
      
      emitter.emitStateChanged({
        agentId: 'agent-123',
        agentRole: AgentRole.CEO,
        previousState: AgentState.IDLE,
        currentState: AgentState.THINKING,
        timestamp: new Date(),
      });
      
      expect(observer1.onStateChanged).toHaveBeenCalledTimes(1);
      expect(observer2.onStateChanged).toHaveBeenCalledTimes(1);
      expect(observer3.onStateChanged).toHaveBeenCalledTimes(1);
    });

    it('should not call removed observer', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      emitter.removeObserver(observer);
      
      emitter.emitStateChanged({
        agentId: 'agent-123',
        agentRole: AgentRole.CEO,
        previousState: AgentState.IDLE,
        currentState: AgentState.THINKING,
        timestamp: new Date(),
      });
      
      expect(observer.onStateChanged).not.toHaveBeenCalled();
    });
  });

  describe('ThinkingStarted Event Emission', () => {
    it('should emit thinkingStarted event to observer', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      
      emitter.emitThinkingStarted({
        agentId: 'agent-123',
        agentRole: AgentRole.CEO,
        taskId: 'task-456',
        message: 'Analyzing strategic options',
        timestamp: new Date(),
      });
      
      expect(observer.onThinkingStarted).toHaveBeenCalledTimes(1);
      expect(observer.onThinkingStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
          taskId: 'task-456',
          message: 'Analyzing strategic options',
        })
      );
    });

    it('should emit to multiple observers', () => {
      const emitter = new AgentEventEmitter();
      const observer1 = createMockAgentObserver();
      const observer2 = createMockAgentObserver();
      
      emitter.addObserver(observer1);
      emitter.addObserver(observer2);
      
      emitter.emitThinkingStarted({
        agentId: 'agent-123',
        agentRole: AgentRole.DEV,
        taskId: 'task-456',
        message: 'Planning implementation',
        timestamp: new Date(),
      });
      
      expect(observer1.onThinkingStarted).toHaveBeenCalledTimes(1);
      expect(observer2.onThinkingStarted).toHaveBeenCalledTimes(1);
    });
  });

  describe('ActionCompleted Event Emission', () => {
    it('should emit actionCompleted event to observer', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      
      emitter.emitActionCompleted({
        agentId: 'agent-123',
        agentRole: AgentRole.DEV,
        taskId: 'task-456',
        actionType: 'implement',
        toolName: 'write_file',
        parameters: { filepath: 'src/index.ts' },
        timestamp: new Date(),
      });
      
      expect(observer.onActionCompleted).toHaveBeenCalledTimes(1);
      expect(observer.onActionCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
          actionType: 'implement',
          toolName: 'write_file',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should continue emitting to other observers if one throws error', () => {
      const emitter = new AgentEventEmitter();
      const badObserver = createMockAgentObserver();
      const goodObserver = createMockAgentObserver();
      
      // Mock bad observer to throw error
      badObserver.onStateChanged.mockImplementation(() => {
        throw new Error('Observer error');
      });
      
      emitter.addObserver(badObserver);
      emitter.addObserver(goodObserver);
      
      // Should not throw
      expect(() => {
        emitter.emitStateChanged({
          agentId: 'agent-123',
          agentRole: AgentRole.CEO,
          previousState: AgentState.IDLE,
          currentState: AgentState.THINKING,
          timestamp: new Date(),
        });
      }).not.toThrow();
      
      // Good observer should still be called
      expect(goodObserver.onStateChanged).toHaveBeenCalledTimes(1);
    });

    it('should log errors from observers', () => {
      const emitter = new AgentEventEmitter();
      const badObserver = createMockAgentObserver();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      badObserver.onStateChanged.mockImplementation(() => {
        throw new Error('Observer error');
      });
      
      emitter.addObserver(badObserver);
      
      emitter.emitStateChanged({
        agentId: 'agent-123',
        agentRole: AgentRole.CEO,
        previousState: AgentState.IDLE,
        currentState: AgentState.THINKING,
        timestamp: new Date(),
      });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Event Ordering', () => {
    it('should call observers in order they were added', () => {
      const emitter = new AgentEventEmitter();
      const callOrder: number[] = [];
      
      const observer1 = createMockAgentObserver();
      observer1.onStateChanged.mockImplementation(() => callOrder.push(1));
      
      const observer2 = createMockAgentObserver();
      observer2.onStateChanged.mockImplementation(() => callOrder.push(2));
      
      const observer3 = createMockAgentObserver();
      observer3.onStateChanged.mockImplementation(() => callOrder.push(3));
      
      emitter.addObserver(observer1);
      emitter.addObserver(observer2);
      emitter.addObserver(observer3);
      
      emitter.emitStateChanged({
        agentId: 'agent-123',
        agentRole: AgentRole.CEO,
        previousState: AgentState.IDLE,
        currentState: AgentState.THINKING,
        timestamp: new Date(),
      });
      
      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('hasObserver', () => {
    it('should return true if observer exists', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      emitter.addObserver(observer);
      
      expect(emitter.hasObserver(observer)).toBe(true);
    });

    it('should return false if observer does not exist', () => {
      const emitter = new AgentEventEmitter();
      const observer = createMockAgentObserver();
      
      expect(emitter.hasObserver(observer)).toBe(false);
    });
  });
});
