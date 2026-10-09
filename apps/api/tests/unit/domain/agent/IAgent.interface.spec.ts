/**
 * IAgent Interface Contract Tests
 * 
 * Tests that verify the IAgent interface contract and its methods.
 * Following TDD: These tests define the expected behavior BEFORE implementation.
 * 
 * @module tests/unit/domain/agent/IAgent.interface.spec
 */

import { IAgent } from '../../../../src/domain/agent/interfaces/IAgent.interface';
import { AgentState } from '../../../../src/domain/agent/AgentState';
import { AgentRole } from '@ai-corp/shared-types';
import { createMockAgentContext } from '../../../utils';

// Mock implementation for testing interface contract
class MockAgent implements IAgent {
  constructor(
    private id: string,
    private role: AgentRole,
    private state: AgentState = AgentState.IDLE
  ) {}

  getId(): string {
    return this.id;
  }

  getRole(): AgentRole {
    return this.role;
  }

  getState(): AgentState {
    return this.state;
  }

  async execute(context: any): Promise<any> {
    return { thought: {}, action: {} };
  }

  addEventListener(observer: any): void {
    // Mock implementation
  }

  removeEventListener(observer: any): void {
    // Mock implementation
  }
}

describe('IAgent Interface', () => {
  describe('Interface Contract', () => {
    it('should define getId method', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.getId).toBeDefined();
      expect(typeof agent.getId).toBe('function');
    });

    it('should define getRole method', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.getRole).toBeDefined();
      expect(typeof agent.getRole).toBe('function');
    });

    it('should define getState method', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.getState).toBeDefined();
      expect(typeof agent.getState).toBe('function');
    });

    it('should define execute method', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.execute).toBeDefined();
      expect(typeof agent.execute).toBe('function');
    });

    it('should define addEventListener method', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.addEventListener).toBeDefined();
      expect(typeof agent.addEventListener).toBe('function');
    });

    it('should define removeEventListener method', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.removeEventListener).toBeDefined();
      expect(typeof agent.removeEventListener).toBe('function');
    });
  });

  describe('Method Behavior', () => {
    it('should return unique agent ID', () => {
      const agent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.getId()).toBe('agent-123');
    });

    it('should return agent role', () => {
      const agent = new MockAgent('agent-123', AgentRole.CEO);
      expect(agent.getRole()).toBe(AgentRole.CEO);
    });

    it('should return current state', () => {
      const agent = new MockAgent('agent-123', AgentRole.CEO, AgentState.THINKING);
      expect(agent.getState()).toBe(AgentState.THINKING);
    });

    it('should execute with context and return result', async () => {
      const agent = new MockAgent('agent-123', AgentRole.CEO);
      const context = createMockAgentContext();
      
      const result = await agent.execute(context);
      
      expect(result).toBeDefined();
      expect(result.thought).toBeDefined();
      expect(result.action).toBeDefined();
    });

    it('should allow adding event listeners', () => {
      const agent = new MockAgent('agent-123', AgentRole.CEO);
      const observer = { onStateChanged: jest.fn() };
      
      expect(() => agent.addEventListener(observer)).not.toThrow();
    });

    it('should allow removing event listeners', () => {
      const agent = new MockAgent('agent-123', AgentRole.CEO);
      const observer = { onStateChanged: jest.fn() };
      
      agent.addEventListener(observer);
      expect(() => agent.removeEventListener(observer)).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce AgentRole type', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.DEV);
      const role = agent.getRole();
      
      // TypeScript ensures role is AgentRole type
      expect(Object.values(AgentRole)).toContain(role);
    });

    it('should enforce AgentState type', () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO, AgentState.ACTING);
      const state = agent.getState();
      
      // TypeScript ensures state is AgentState type
      expect(Object.values(AgentState)).toContain(state);
    });

    it('should accept AgentContext in execute method', async () => {
      const agent: IAgent = new MockAgent('agent-123', AgentRole.CEO);
      const context = createMockAgentContext({
        taskId: 'task-123',
        projectId: 'project-456',
      });
      
      const result = await agent.execute(context);
      expect(result).toBeDefined();
    });
  });

  describe('Liskov Substitution Principle', () => {
    it('should be substitutable by any concrete agent implementation', () => {
      const agents: IAgent[] = [
        new MockAgent('agent-1', AgentRole.CEO),
        new MockAgent('agent-2', AgentRole.DEV),
        new MockAgent('agent-3', AgentRole.QA),
      ];
      
      agents.forEach((agent) => {
        expect(agent.getId()).toBeDefined();
        expect(agent.getRole()).toBeDefined();
        expect(agent.getState()).toBeDefined();
      });
    });
  });
});
