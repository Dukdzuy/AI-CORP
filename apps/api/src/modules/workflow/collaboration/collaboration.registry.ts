import { CollaborationStrategy } from './collaboration-strategy';

/**
 * CollaborationRegistry: pattern name → strategy. A new pattern is one more register() call,
 * the agent_collaboration node does not change (Open/Closed Principle).
 *
 * @pattern Registry
 */
export class CollaborationRegistry {
  private readonly strategies = new Map<string, CollaborationStrategy>();

  constructor(strategies: CollaborationStrategy[] = []) {
    strategies.forEach(s => this.register(s));
  }

  register(strategy: CollaborationStrategy): this {
    if (this.strategies.has(strategy.pattern)) {
      throw new Error(`Collaboration pattern ${strategy.pattern} is already registered`);
    }
    this.strategies.set(strategy.pattern, strategy);
    return this;
  }

  get(pattern: string): CollaborationStrategy {
    const strategy = this.strategies.get(pattern);
    if (!strategy) {
      throw new Error(`Unknown collaboration pattern: ${pattern}. Available: ${this.patterns().join(', ')}`);
    }
    return strategy;
  }

  patterns(): string[] {
    return [...this.strategies.keys()];
  }
}
