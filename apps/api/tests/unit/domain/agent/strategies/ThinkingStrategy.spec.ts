/**
 * Thinking Strategy Tests
 * 
 * Tests for concrete thinking strategy implementations.
 * Following TDD: These tests are written BEFORE implementation.
 * 
 * Tests cover:
 * - BaseThinkingStrategy abstract class
 * - CEOThinkingStrategy (strategic planning)
 * - PMThinkingStrategy (task decomposition)
 * - DEVThinkingStrategy (technical implementation)
 * - QAThinkingStrategy (testing approach)
 * - MarketingThinkingStrategy (marketing analysis)
 * 
 * @module tests/unit/domain/agent/strategies/ThinkingStrategy.spec
 */

import { AgentRole } from '@ai-corp/shared-types';
import {
  AgentContext,
  AgentThought,
} from '../../../../../src/domain/common/types';
import {
  BaseThinkingStrategy,
  CEOThinkingStrategy,
  PMThinkingStrategy,
  DEVThinkingStrategy,
  QAThinkingStrategy,
  MarketingThinkingStrategy,
} from '../../../../../src/domain/agent/strategies/ThinkingStrategy';
import { createMockAgentContext } from '../../../../utils';

describe('BaseThinkingStrategy', () => {
  // We'll test BaseThinkingStrategy through concrete implementations
  // since it's abstract

  describe('Common Strategy Behavior', () => {
    it('should have execute method that returns AgentThought', async () => {
      const strategy = new CEOThinkingStrategy();
      const context = createMockAgentContext({
        task: 'Create a new product',
      });

      const result = await strategy.think(context);

      expect(result).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.plannedActions).toBeDefined();
      expect(Array.isArray(result.plannedActions)).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include context in error messages', async () => {
      const strategy = new CEOThinkingStrategy();
      const invalidContext = {} as AgentContext; // Invalid context

      await expect(strategy.think(invalidContext)).rejects.toThrow();
    });
  });
});

describe('CEOThinkingStrategy', () => {
  let strategy: CEOThinkingStrategy;

  beforeEach(() => {
    strategy = new CEOThinkingStrategy();
  });

  describe('Strategic Planning', () => {
    it('should create high-level strategic plan', async () => {
      const context = createMockAgentContext({
        task: 'Launch a new AI-powered SaaS product',
        projectContext: {
          goal: 'Become market leader in AI agents',
          description: 'Multi-agent collaboration platform',
        },
      });

      const result = await strategy.think(context);

      expect(result.reasoning).toContain('strategic');
      expect(result.plannedActions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should delegate implementation to other agents', async () => {
      const context = createMockAgentContext({
        task: 'Build MVP for Q1 launch',
      });

      const result = await strategy.think(context);

      // CEO should plan delegation, not implementation
      const hasDelegation = result.plannedActions.some(
        (action) =>
          action.toolName === 'delegate_task' ||
          action.rationale.toLowerCase().includes('delegate'),
      );

      expect(hasDelegation).toBe(true);
    });

    it('should focus on business objectives', async () => {
      const context = createMockAgentContext({
        task: 'Increase user engagement',
      });

      const result = await strategy.think(context);

      const businessFocus =
        result.reasoning.toLowerCase().includes('business') ||
        result.reasoning.toLowerCase().includes('user') ||
        result.reasoning.toLowerCase().includes('market');

      expect(businessFocus).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    it('should identify potential risks', async () => {
      const context = createMockAgentContext({
        task: 'Enter new market segment',
      });

      const result = await strategy.think(context);

      const hasRiskConsideration =
        result.reasoning.toLowerCase().includes('risk') ||
        result.metadata?.risks !== undefined;

      expect(hasRiskConsideration).toBe(true);
    });
  });
});

describe('PMThinkingStrategy', () => {
  let strategy: PMThinkingStrategy;

  beforeEach(() => {
    strategy = new PMThinkingStrategy();
  });

  describe('Task Decomposition', () => {
    it('should break down complex tasks into subtasks', async () => {
      const context = createMockAgentContext({
        task: 'Build user authentication system',
      });

      const result = await strategy.think(context);

      expect(result.plannedActions.length).toBeGreaterThan(1);
      expect(result.metadata?.subtasks).toBeDefined();
    });

    it('should create actionable tasks for developers', async () => {
      const context = createMockAgentContext({
        task: 'Implement real-time notifications',
      });

      const result = await strategy.think(context);

      result.plannedActions.forEach((action) => {
        expect(action.toolName).toBeDefined();
        expect(action.rationale).toBeDefined();
        expect(action.parameters).toBeDefined();
      });
    });

    it('should prioritize tasks', async () => {
      const context = createMockAgentContext({
        task: 'Release version 2.0',
      });

      const result = await strategy.think(context);

      expect(result.metadata?.priority).toBeDefined();
    });
  });

  describe('Dependency Management', () => {
    it('should identify task dependencies', async () => {
      const context = createMockAgentContext({
        task: 'Build and deploy new feature',
      });

      const result = await strategy.think(context);

      const hasDependencies =
        result.metadata?.dependencies !== undefined ||
        result.reasoning.toLowerCase().includes('depend');

      expect(hasDependencies).toBe(true);
    });
  });
});

describe('DEVThinkingStrategy', () => {
  let strategy: DEVThinkingStrategy;

  beforeEach(() => {
    strategy = new DEVThinkingStrategy();
  });

  describe('Technical Implementation', () => {
    it('should plan technical implementation steps', async () => {
      const context = createMockAgentContext({
        task: 'Add Redis caching layer',
        availableTools: [
          {
            name: 'write_file',
            description: 'Write code file',
            parameters: {},
          },
          {
            name: 'run_command',
            description: 'Execute command',
            parameters: {},
          },
        ],
      });

      const result = await strategy.think(context);

      expect(result.plannedActions.length).toBeGreaterThan(0);
      
      // Should use technical tools
      const usesTechnicalTools = result.plannedActions.some(
        (action) =>
          action.toolName === 'write_file' ||
          action.toolName === 'run_command' ||
          action.toolName === 'read_file',
      );

      expect(usesTechnicalTools).toBe(true);
    });

    it('should consider code quality', async () => {
      const context = createMockAgentContext({
        task: 'Refactor authentication module',
      });

      const result = await strategy.think(context);

      const hasQualityConsideration =
        result.reasoning.toLowerCase().includes('quality') ||
        result.reasoning.toLowerCase().includes('clean') ||
        result.reasoning.toLowerCase().includes('maintainable');

      expect(hasQualityConsideration).toBe(true);
    });

    it('should reference relevant memories', async () => {
      const context = createMockAgentContext({
        task: 'Implement new API endpoint',
        relevantMemories: [
          {
            id: 'mem-1',
            agentRole: AgentRole.DEV,
            namespace: 'coding_conventions',
            content: 'Use RESTful conventions',
            importance: 8,
            timestamp: new Date(),
          },
        ],
      });

      const result = await strategy.think(context);

      expect(result.metadata?.memoriesUsed).toBeDefined();
    });
  });

  describe('Best Practices', () => {
    it('should apply coding best practices', async () => {
      const context = createMockAgentContext({
        task: 'Create data validation layer',
      });

      const result = await strategy.think(context);

      const hasBestPractices =
        result.reasoning.toLowerCase().includes('test') ||
        result.reasoning.toLowerCase().includes('validation') ||
        result.reasoning.toLowerCase().includes('error handling');

      expect(hasBestPractices).toBe(true);
    });
  });
});

describe('QAThinkingStrategy', () => {
  let strategy: QAThinkingStrategy;

  beforeEach(() => {
    strategy = new QAThinkingStrategy();
  });

  describe('Test Planning', () => {
    it('should create comprehensive test plan', async () => {
      const context = createMockAgentContext({
        task: 'Test user registration flow',
      });

      const result = await strategy.think(context);

      expect(result.plannedActions.length).toBeGreaterThan(0);
      
      const hasTestActions = result.plannedActions.some(
        (action) =>
          action.toolName === 'run_tests' ||
          action.toolName === 'write_test' ||
          action.rationale.toLowerCase().includes('test'),
      );

      expect(hasTestActions).toBe(true);
    });

    it('should identify test scenarios', async () => {
      const context = createMockAgentContext({
        task: 'Verify payment processing',
      });

      const result = await strategy.think(context);

      expect(result.metadata?.testScenarios).toBeDefined();
      expect(Array.isArray(result.metadata?.testScenarios)).toBe(true);
    });

    it('should cover edge cases', async () => {
      const context = createMockAgentContext({
        task: 'Test file upload feature',
      });

      const result = await strategy.think(context);

      const hasEdgeCases =
        result.reasoning.toLowerCase().includes('edge case') ||
        result.reasoning.toLowerCase().includes('boundary') ||
        result.reasoning.toLowerCase().includes('error');

      expect(hasEdgeCases).toBe(true);
    });
  });

  describe('Quality Assurance', () => {
    it('should verify quality requirements', async () => {
      const context = createMockAgentContext({
        task: 'Validate API performance',
      });

      const result = await strategy.think(context);

      const hasQAFocus =
        result.reasoning.toLowerCase().includes('quality') ||
        result.reasoning.toLowerCase().includes('performance') ||
        result.reasoning.toLowerCase().includes('reliability');

      expect(hasQAFocus).toBe(true);
    });
  });
});

describe('MarketingThinkingStrategy', () => {
  let strategy: MarketingThinkingStrategy;

  beforeEach(() => {
    strategy = new MarketingThinkingStrategy();
  });

  describe('Marketing Analysis', () => {
    it('should analyze target audience', async () => {
      const context = createMockAgentContext({
        task: 'Create launch campaign',
        projectContext: {
          name: 'AI Agent Platform',
          goal: 'Acquire 10k users in Q1',
        },
      });

      const result = await strategy.think(context);

      const hasAudienceAnalysis =
        result.reasoning.toLowerCase().includes('audience') ||
        result.reasoning.toLowerCase().includes('user') ||
        result.reasoning.toLowerCase().includes('customer');

      expect(hasAudienceAnalysis).toBe(true);
    });

    it('should plan marketing activities', async () => {
      const context = createMockAgentContext({
        task: 'Increase brand awareness',
      });

      const result = await strategy.think(context);

      expect(result.plannedActions.length).toBeGreaterThan(0);
      
      const hasMarketingActions = result.plannedActions.some(
        (action) =>
          action.toolName === 'create_content' ||
          action.toolName === 'analyze_metrics' ||
          action.rationale.toLowerCase().includes('campaign'),
      );

      expect(hasMarketingActions).toBe(true);
    });

    it('should consider metrics and KPIs', async () => {
      const context = createMockAgentContext({
        task: 'Improve conversion rate',
      });

      const result = await strategy.think(context);

      const hasMetrics =
        result.reasoning.toLowerCase().includes('metric') ||
        result.reasoning.toLowerCase().includes('kpi') ||
        result.reasoning.toLowerCase().includes('conversion') ||
        result.metadata?.metrics !== undefined;

      expect(hasMetrics).toBe(true);
    });
  });

  describe('Content Strategy', () => {
    it('should plan content creation', async () => {
      const context = createMockAgentContext({
        task: 'Create product launch content',
      });

      const result = await strategy.think(context);

      const hasContentStrategy =
        result.reasoning.toLowerCase().includes('content') ||
        result.reasoning.toLowerCase().includes('message') ||
        result.reasoning.toLowerCase().includes('communication');

      expect(hasContentStrategy).toBe(true);
    });
  });
});

describe('Strategy Pattern Integration', () => {
  it('should allow runtime strategy selection', async () => {
    const strategies = [
      new CEOThinkingStrategy(),
      new PMThinkingStrategy(),
      new DEVThinkingStrategy(),
      new QAThinkingStrategy(),
      new MarketingThinkingStrategy(),
    ];

    const context = createMockAgentContext({
      task: 'Test strategy pattern',
    });

    for (const strategy of strategies) {
      const result = await strategy.think(context);
      expect(result).toBeDefined();
      expect(result.reasoning).toBeDefined();
    }
  });

  it('should produce different results for different strategies', async () => {
    const ceoStrategy = new CEOThinkingStrategy();
    const devStrategy = new DEVThinkingStrategy();

    const context = createMockAgentContext({
      task: 'Build new feature',
    });

    const ceoResult = await ceoStrategy.think(context);
    const devResult = await devStrategy.think(context);

    // Results should be different (different reasoning approaches)
    expect(ceoResult.reasoning).not.toBe(devResult.reasoning);
  });
});
