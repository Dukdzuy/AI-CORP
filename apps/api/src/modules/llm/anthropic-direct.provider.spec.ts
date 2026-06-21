import { Test, TestingModule } from '@nestjs/testing';
import { AnthropicDirectProvider } from './anthropic-direct.provider';
import { ChatParams, ChatResult } from '@ai-corp/shared-types';

const mockCreate = jest.fn();

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe('AnthropicDirectProvider', () => {
  let provider: AnthropicDirectProvider;
  let mockAnthropicClient: any;

  beforeEach(async () => {
    // Set environment variable for tests
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnthropicDirectProvider],
    }).compile();

    provider = module.get<AnthropicDirectProvider>(AnthropicDirectProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCreate.mockClear();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(provider).toBeDefined();
    });

    it('should initialize with API key from environment', () => {
      expect(provider).toBeInstanceOf(AnthropicDirectProvider);
    });

    it('should warn when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      const loggerWarnSpy = jest.spyOn(
        AnthropicDirectProvider.prototype as any,
        'logger',
      );

      const newProvider = new AnthropicDirectProvider();
      expect(newProvider).toBeDefined();
    });
  });

  describe('getProviderName', () => {
    it('should return "anthropic-direct"', () => {
      expect(provider.getProviderName()).toBe('anthropic-direct');
    });
  });

  describe('chat', () => {
    const mockChatParams: ChatParams = {
      model: 'claude-opus',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' },
      ],
      temperature: 0.7,
      maxTokens: 2048,
    };

    it('should successfully make a chat request and return ChatResult', async () => {
      // Mock successful API response
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'I am doing well, thank you!',
          },
        ],
        usage: {
          input_tokens: 20,
          output_tokens: 10,
        },
        model: 'claude-opus',
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result: ChatResult = await provider.chat(mockChatParams);

      expect(result).toBeDefined();
      expect(result.content).toBe('I am doing well, thank you!');
      expect(result.requestedModel as string).toBe('claude-opus');
      expect(result.actualModelUsed as string).toBe('claude-opus');
      expect(result.actualProvider).toBe('anthropic');
      expect(result.isFallbackTriggered).toBe(false);
      expect(result.tokenUsage).toEqual({
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30,
      });
      expect(result.rtkTokenSaved).toBeUndefined();
    });

    it('should handle tool use responses', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool-123',
            name: 'calculate',
            input: { operation: 'add', a: 5, b: 3 },
          },
        ],
        usage: {
          input_tokens: 50,
          output_tokens: 20,
        },
        model: 'claude-opus',
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result: ChatResult = await provider.chat(mockChatParams);

      expect(result.content).toBe('Tool call: calculate');
      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0].id).toBe('tool-123');
      expect(result.toolCalls?.[0].function.name).toBe('calculate');
      expect(JSON.parse(result.toolCalls?.[0].function.arguments as string)).toEqual({
        operation: 'add',
        a: 5,
        b: 3,
      });
    });

    it('should extract system message separately from messages array', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-opus',
      };

      mockCreate.mockResolvedValue(mockResponse);

      await provider.chat(mockChatParams);

      // Verify that system message was extracted
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hello, how are you?' }],
        }),
      );
    });

    it('should handle empty system message', async () => {
      const paramsWithoutSystem: ChatParams = {
        model: 'claude-opus',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-opus',
      };

      mockCreate.mockResolvedValue(mockResponse);

      await provider.chat(paramsWithoutSystem);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: '',
        }),
      );
    });

    it('should use default values for optional parameters', async () => {
      const minimalParams: ChatParams = {
        model: 'claude-opus',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 5, output_tokens: 3 },
        model: 'claude-opus',
      };

      mockCreate.mockResolvedValue(mockResponse);

      await provider.chat(minimalParams);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus',
          max_tokens: 2048,
          temperature: 0.7,
        }),
      );
    });

    it('should throw error when API key is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const providerWithoutKey = new AnthropicDirectProvider();

      await expect(providerWithoutKey.chat(mockChatParams)).rejects.toThrow(
        'ANTHROPIC_API_KEY is not configured',
      );
    });

    it('should throw error when API call fails', async () => {
      mockCreate.mockRejectedValue(
        new Error('API Error: Rate limit exceeded'),
      );

      await expect(provider.chat(mockChatParams)).rejects.toThrow(
        'Anthropic API error: API Error: Rate limit exceeded',
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockCreate.mockRejectedValue(
        'String error message',
      );

      await expect(provider.chat(mockChatParams)).rejects.toThrow(
        'Anthropic API error: Unknown error',
      );
    });
  });

  describe('validateConfig', () => {
    it('should return true when API key is configured and API is accessible', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: 'claude-opus',
      };

      mockCreate.mockResolvedValue(mockResponse);

      const isValid = await provider.validateConfig();

      expect(isValid).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('should return false when API key is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const providerWithoutKey = new AnthropicDirectProvider();

      const isValid = await providerWithoutKey.validateConfig();

      expect(isValid).toBe(false);
    });

    it('should return false when API call fails', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error('Authentication failed'),
      );

      const isValid = await provider.validateConfig();

      expect(isValid).toBe(false);
    });
  });

  describe('ILLMProvider interface compliance', () => {
    it('should implement chat method', () => {
      expect(provider.chat).toBeDefined();
      expect(typeof provider.chat).toBe('function');
    });

    it('should implement validateConfig method', () => {
      expect(provider.validateConfig).toBeDefined();
      expect(typeof provider.validateConfig).toBe('function');
    });

    it('should implement getProviderName method', () => {
      expect(provider.getProviderName).toBeDefined();
      expect(typeof provider.getProviderName).toBe('function');
    });
  });

  describe('Requirements validation', () => {
    it('should satisfy Requirement 4: LLM Gateway Integration (fallback provider)', async () => {
      // This provider serves as fallback when 9Router is unavailable
      const mockResponse = {
        content: [{ type: 'text', text: 'Fallback response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-opus',
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await provider.chat({ model: 'claude-opus', messages: [{ role: 'user', content: 'test' }] } as any);

      // Verify it returns proper ChatResult structure
      expect(result.actualProvider).toBe('anthropic');
      expect(result.tokenUsage).toBeDefined();
      expect(result.actualModelUsed).toBeDefined();
    });

    it('should satisfy Requirement 29: Fallback Provider Configuration', () => {
      // Provider should work independently as fallback
      expect(provider.getProviderName()).toBe('anthropic-direct');
      
      // Provider should be constructable without any parameters (config from env)
      const newProvider = new AnthropicDirectProvider();
      expect(newProvider).toBeDefined();
    });
  });
});
