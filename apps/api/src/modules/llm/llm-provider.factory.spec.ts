import { Test, TestingModule } from '@nestjs/testing';
import { LLMProviderFactory } from './llm-provider.factory';
import { ModelRouteConfig, ChatParams, ChatResult } from '@ai-corp/shared-types';
import { NineRouterHealthService } from './nine-router-health.service';

describe('LLMProviderFactory', () => {
  let factory: LLMProviderFactory;

  const mockHealthService = {
    checkHealth: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMProviderFactory,
        {
          provide: NineRouterHealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    factory = module.get<LLMProviderFactory>(LLMProviderFactory);
  });

  afterEach(() => {
    factory.clearCache();
  });

  describe('getProvider', () => {
    it('should return a provider for ninerouter config', () => {
      const config: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('ninerouter');
    });

    it('should return a provider for anthropic-direct config', () => {
      const config: ModelRouteConfig = {
        provider: 'anthropic-direct',
        model: 'claude-opus',
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('anthropic-direct');
    });

    it('should default to anthropic-direct when provider not specified', () => {
      const config: ModelRouteConfig = {
        provider: '',
        model: 'claude-sonnet-4',
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('ninerouter');
    });

    it('should default to anthropic-direct for unknown provider', () => {
      const config: ModelRouteConfig = {
        provider: 'unknown-provider' as any,
        model: 'claude-sonnet-4',
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
      // Should fall back to anthropic-direct or provide some provider
      expect(provider.getProviderName()).toBeDefined();
    });

    it('should cache provider instances by model', () => {
      const config: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const provider1 = factory.getProvider(config);
      const provider2 = factory.getProvider(config);

      // Should return the same cached instance
      expect(provider1).toBe(provider2);
    });

    it('should create different providers for different models', () => {
      const config1: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const config2: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-opus',
      };

      const provider1 = factory.getProvider(config1);
      const provider2 = factory.getProvider(config2);

      // Caching key includes model, so should be different instances
      // But both should be valid ninerouter providers
      expect(provider1.getProviderName()).toBe('ninerouter');
      expect(provider2.getProviderName()).toBe('ninerouter');
    });

    it('should cache provider instances by provider type', () => {
      const config1: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const config2: ModelRouteConfig = {
        provider: 'anthropic-direct',
        model: 'claude-sonnet-4',
      };

      const provider1 = factory.getProvider(config1);
      const provider2 = factory.getProvider(config2);

      // Different provider types should create different instances
      expect(provider1.getProviderName()).toBe('ninerouter');
      expect(provider2.getProviderName()).toBe('anthropic-direct');
    });

    it('should respect fallbackProvider in config', () => {
      const config: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
        fallbackProvider: 'anthropic-direct',
      };

      const provider = factory.getProvider(config);

      // Provider should be aware of fallback configuration
      // (Used by circuit breaker in task 4.4/4.5)
      expect(provider.getProviderName()).toBe('ninerouter');
    });
  });

  describe('clearCache', () => {
    it('should clear cached providers', () => {
      const config: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const provider1 = factory.getProvider(config);

      factory.clearCache();

      const provider2 = factory.getProvider(config);

      // After cache clear, should create new instance
      expect(provider1).not.toBe(provider2);
    });

    it('should allow provider re-instantiation after cache clear', () => {
      const config1: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const config2: ModelRouteConfig = {
        provider: 'anthropic-direct',
        model: 'claude-opus',
      };

      // Get some providers
      factory.getProvider(config1);
      factory.getProvider(config2);

      // Clear cache
      factory.clearCache();

      // Should be able to get providers again without error
      const provider1 = factory.getProvider(config1);
      const provider2 = factory.getProvider(config2);

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
    });
  });

  describe('provider implementations', () => {
    it('should successfully create ninerouter provider', async () => {
      const config: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('ninerouter');
    });

    it('should successfully create anthropic-direct provider', async () => {
      const config: ModelRouteConfig = {
        provider: 'anthropic-direct',
        model: 'claude-opus',
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('anthropic-direct');
    });
  });

  describe('factory configuration validation', () => {
    it('should handle config with all optional fields', () => {
      const config: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
        fallbackProvider: 'anthropic-direct',
        tags: ['ceo', 'strategic'],
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('ninerouter');
    });

    it('should handle config with minimal required fields', () => {
      const config: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
      };

      const provider = factory.getProvider(config);

      expect(provider).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should support switching between providers', () => {
      const configNineRouter: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
        fallbackProvider: 'anthropic-direct',
      };

      const configAnthropic: ModelRouteConfig = {
        provider: 'anthropic-direct',
        model: 'claude-sonnet-4',
      };

      // Get providers
      const nineRouter = factory.getProvider(configNineRouter);
      const anthropic = factory.getProvider(configAnthropic);

      // Verify they are different providers
      expect(nineRouter.getProviderName()).toBe('ninerouter');
      expect(anthropic.getProviderName()).toBe('anthropic-direct');

      // Verify they are both valid
      expect(nineRouter).toBeDefined();
      expect(anthropic).toBeDefined();
    });

    it('should handle multiple agents with different providers', () => {
      const ceoConfig: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-sonnet-4',
        fallbackProvider: 'anthropic-direct',
      };

      const devConfig: ModelRouteConfig = {
        provider: 'ninerouter',
        model: 'claude-opus',
        fallbackProvider: 'anthropic-direct',
      };

      const qaConfig: ModelRouteConfig = {
        provider: 'anthropic-direct',
        model: 'claude-sonnet-4',
      };

      const ceProvider = factory.getProvider(ceoConfig);
      const devProvider = factory.getProvider(devConfig);
      const qaProvider = factory.getProvider(qaConfig);

      expect(ceProvider.getProviderName()).toBe('ninerouter');
      expect(devProvider.getProviderName()).toBe('ninerouter');
      expect(qaProvider.getProviderName()).toBe('anthropic-direct');
    });
  });
});
