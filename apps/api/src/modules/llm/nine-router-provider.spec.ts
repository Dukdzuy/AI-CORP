import { NineRouterProvider } from './nine-router-provider';
import { ChatParams, ChatResult } from '@ai-corp/shared-types';

// Create shared mock functions
const mockCreate = jest.fn();
const mockList = jest.fn();

// Mock the OpenAI client
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      models: {
        list: mockList,
      },
    })),
  };
});

describe('NineRouterProvider', () => {
  const baseURL = 'http://localhost:20128/v1';
  const apiKey = 'test-api-key';
  let provider: NineRouterProvider;

  beforeEach(() => {
    provider = new NineRouterProvider(baseURL, apiKey);
    jest.clearAllMocks();
    mockCreate.mockClear();
    mockList.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with valid baseURL and apiKey', () => {
      expect(() => new NineRouterProvider(baseURL, apiKey)).not.toThrow();
    });

    it('should throw error if baseURL is missing', () => {
      expect(() => new NineRouterProvider('', apiKey)).toThrow(
        'NINE_ROUTER_URL environment variable is not set',
      );
    });

    it('should throw error if apiKey is missing', () => {
      expect(() => new NineRouterProvider(baseURL, '')).toThrow(
        'NINE_ROUTER_API_KEY environment variable is not set',
      );
    });
  });

  describe('getProviderName', () => {
    it('should return "ninerouter"', () => {
      expect(provider.getProviderName()).toBe('ninerouter');
    });
  });

  describe('chat', () => {
    it('should send chat request and return ChatResult', async () => {
      const mockResponse = {
        model: 'claude-sonnet-4',
        choices: [
          {
            message: {
              content: 'Test response',
              tool_calls: undefined,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await provider.chat(params);

      expect(result).toBeDefined();
      expect(result.content).toBe('Test response');
      expect(result.requestedModel).toBe('claude-sonnet-4');
      expect(result.actualModelUsed).toBe('claude-sonnet-4');
      expect(result.actualProvider).toBe('ninerouter');
      expect(result.isFallbackTriggered).toBe(false);
      expect(result.tokenUsage.totalTokens).toBe(30);
    });

    it('should handle fallback when actual model differs from requested', async () => {
      const mockResponse = {
        model: 'gpt-4', // Different from requested
        choices: [
          {
            message: {
              content: 'Fallback response',
              tool_calls: undefined,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4', // Requested model
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await provider.chat(params);

      expect(result.actualModelUsed).toBe('gpt-4');
      expect(result.isFallbackTriggered).toBe(true);
    });

    it('should extract RTK tokens saved when present', async () => {
      const mockResponse = {
        model: 'claude-sonnet-4',
        rtk_tokens_saved: 15,
        choices: [
          {
            message: {
              content: 'Response with RTK',
              tool_calls: undefined,
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await provider.chat(params);

      expect(result.rtkTokenSaved).toBe(15);
    });

    it('should extract provider from response headers', async () => {
      const mockResponse = {
        model: 'claude-sonnet-4',
        headers: {
          'x-provider': 'anthropic',
          'x-rtk-tokens-saved': '25',
        },
        choices: [
          {
            message: {
              content: 'Response',
              tool_calls: undefined,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await provider.chat(params);

      expect(result.actualProvider).toBe('anthropic');
      expect(result.rtkTokenSaved).toBe(25);
    });

    it('should include temperature and maxTokens in request', async () => {
      const mockResponse = {
        model: 'claude-sonnet-4',
        choices: [
          {
            message: {
              content: 'Response',
              tool_calls: undefined,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
        maxTokens: 100,
      };

      await provider.chat(params);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4',
          temperature: 0.5,
          max_tokens: 100,
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('Connection refused'));

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.chat(params)).rejects.toThrow('Connection refused');
    });

    it('should handle authentication errors', async () => {
      mockCreate.mockRejectedValue(new Error('401 Unauthorized'));

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.chat(params)).rejects.toThrow('401 Unauthorized');
    });
  });

  describe('validateConfig', () => {
    it('should return true when configuration is valid', async () => {
      mockList.mockResolvedValue({ data: [] });

      provider = new NineRouterProvider(baseURL, apiKey);

      const result = await provider.validateConfig();

      expect(result).toBe(true);
    });

    it('should return false when configuration is invalid', async () => {
      mockList.mockRejectedValue(new Error('Connection failed'));

      provider = new NineRouterProvider(baseURL, apiKey);

      const result = await provider.validateConfig();

      expect(result).toBe(false);
    });

    it('should handle authentication validation failures', async () => {
      mockList.mockRejectedValue(new Error('401 Unauthorized'));

      provider = new NineRouterProvider(baseURL, apiKey);

      const result = await provider.validateConfig();

      expect(result).toBe(false);
    });
  });

  describe('token usage tracking', () => {
    it('should accurately track prompt, completion, and total tokens', async () => {
      const mockResponse = {
        model: 'claude-sonnet-4',
        choices: [
          {
            message: {
              content: 'Response',
              tool_calls: undefined,
            },
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 75,
          total_tokens: 125,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await provider.chat(params);

      expect(result.tokenUsage.promptTokens).toBe(50);
      expect(result.tokenUsage.completionTokens).toBe(75);
      expect(result.tokenUsage.totalTokens).toBe(125);
    });

    it('should handle missing usage data', async () => {
      const mockResponse = {
        model: 'claude-sonnet-4',
        choices: [
          {
            message: {
              content: 'Response',
              tool_calls: undefined,
            },
          },
        ],
        // No usage data
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await provider.chat(params);

      expect(result.tokenUsage.promptTokens).toBe(0);
      expect(result.tokenUsage.completionTokens).toBe(0);
      expect(result.tokenUsage.totalTokens).toBe(0);
    });
  });

  describe('tool calls', () => {
    it('should include tool calls in response when present', async () => {
      const mockToolCall = {
        id: 'call_123',
        function: {
          name: 'test_tool',
          arguments: '{"param": "value"}',
        },
      };

      const mockResponse = {
        model: 'claude-sonnet-4',
        choices: [
          {
            message: {
              content: 'Response',
              tool_calls: [mockToolCall],
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      provider = new NineRouterProvider(baseURL, apiKey);

      const params: ChatParams = {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await provider.chat(params);

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls?.length).toBe(1);
      expect(result.toolCalls?.[0].function.name).toBe('test_tool');
    });
  });
});
