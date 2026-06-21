# LLM Gateway Module

The LLM Gateway Module provides a unified interface for interacting with multiple Large Language Model (LLM) providers. It abstracts away provider-specific details and implements automatic fallback routing when the primary provider is unavailable.

## Overview

### Purpose

This module serves as the central hub for all LLM interactions within the AI Corp Platform. It:

1. **Abstracts provider diversity**: Supports 9Router, Anthropic Direct API, and future providers through a common `ILLMProvider` interface
2. **Implements fallback routing**: Automatically routes requests to fallback providers when the primary provider is unavailable
3. **Tracks costs accurately**: Logs actual model usage and costs based on which provider was used, not which was requested
4. **Enables token optimization**: Records RTK tokens saved when 9Router is used with token compression
5. **Supports circuit breaker pattern**: Implements health monitoring and automatic failover

## Architecture

### Core Interfaces (Shared Types)

All interfaces are defined in `@ai-corp/shared-types/src/agent.types.ts`:

```typescript
interface ILLMProvider {
  chat(params: ChatParams): Promise<ChatResult>;
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
}

interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

interface ChatResult {
  content: string;
  requestedModel: string;
  actualModelUsed: string;
  actualProvider: string;
  isFallbackTriggered: boolean;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rtkTokenSaved?: number;
  toolCalls?: ToolCall[];
}
```

### Implementation Strategy

#### LLMProviderFactory (Task 4.1 - This task)

The factory pattern implementation that:
- Instantiates and caches provider instances
- Routes to appropriate provider based on `ModelRouteConfig`
- Provides a single entry point for provider selection

#### NineRouterProvider (Task 4.2)

Implements `ILLMProvider` for the 9Router gateway:
- Uses OpenAI client library configured to point at 9Router (localhost:20128)
- Extracts actual model and provider from response metadata
- Records RTK token savings

#### AnthropicDirectProvider (Task 4.3)

Implements `ILLMProvider` for direct Anthropic API access:
- Uses Anthropic SDK
- Acts as primary fallback when 9Router is unavailable

#### NineRouterHealthService (Task 4.4)

Implements circuit breaker pattern:
- Performs periodic health checks on 9Router
- Tracks consecutive failures
- Opens circuit breaker after 3 failures
- Updates `LLMGatewayStatus` in database

#### LLMProviderFactory Enhancement (Task 4.5)

Extended factory functionality:
- Uses `NineRouterHealthService` to determine routing
- Automatically selects fallback provider when 9Router circuit is open
- Logs all provider switches and reasons

#### API Usage Logging (Task 4.6)

Logging service that:
- Logs all LLM calls with token usage and costs
- Uses actual model pricing (from actual provider)
- Tracks RTK token savings
- Updates project cost tracking in database

## Usage

### Basic Usage

```typescript
import { LLMProviderFactory } from '@ai-corp/shared-types';

constructor(private llmFactory: LLMProviderFactory) {}

async callLLM(params: ChatParams): Promise<ChatResult> {
  const config: ModelRouteConfig = {
    provider: 'ninerouter',
    model: 'claude-sonnet-4',
    fallbackProvider: 'anthropic-direct',
  };
  
  const provider = this.llmFactory.getProvider(config);
  const result = await provider.chat(params);
  
  // result.actualProvider tells us which provider was used
  // result.actualModelUsed tells us which model was actually used
  // result.rtkTokenSaved shows RTK compression savings from 9Router
  
  return result;
}
```

### Provider Routing

The factory uses this logic to select a provider:

1. **If 9Router circuit is CLOSED**: Use NineRouterProvider
   - Sends request to 9Router at localhost:20128
   - 9Router handles provider selection internally (subscription → cheap → free)
   - Results in optimal token savings through RTK compression

2. **If 9Router circuit is OPEN**: Use fallback provider
   - Falls back to AnthropicDirectProvider or configured fallback
   - Bypasses 9Router to ensure service continuity
   - Reduces token savings but maintains functionality

3. **If no fallback configured**: Fail with error
   - Ensures explicit configuration of fallback strategy

## Configuration

Agents are configured with `ModelRouteConfig` in the database:

```json
{
  "provider": "ninerouter",
  "model": "claude-sonnet-4",
  "fallbackProvider": "anthropic-direct",
  "tags": ["ceo", "strategic"]
}
```

Environment variables required:

```env
# 9Router configuration
NINEROUTER_BASE_URL=http://localhost:20128
NINEROUTER_API_KEY=your-api-key

# Anthropic configuration (for fallback)
ANTHROPIC_API_KEY=your-anthropic-key
```

## Cost Tracking

The module accurately tracks costs by:

1. **Recording requested vs actual model**: `ChatResult` contains both
2. **Using actual model pricing**: Costs calculated from `actualModelUsed`, not `requestedModel`
3. **Tracking fallback usage**: `isFallbackTriggered` flag indicates when fallback provider was used
4. **Recording RTK savings**: `rtkTokenSaved` field shows token compression from 9Router
5. **Logging everything**: All calls logged to `ApiUsageLog` table

### Cost Calculation Example

Request: Claude Sonnet 4 via 9Router
Response: Actually Claude Opus (cheaper at this time) via Anthropic

```typescript
ChatResult {
  requestedModel: "claude-sonnet-4",
  actualModelUsed: "claude-opus",
  actualProvider: "anthropic",
  isFallbackTriggered: false,
  tokenUsage: {
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500
  },
  rtkTokenSaved: 200,
  // Cost calculated from Claude Opus pricing
  // Cost tracked as if Opus was requested (saves money!)
}
```

## Circuit Breaker Pattern

9Router health is monitored continuously:

```
[CLOSED] ─── (3 consecutive failures) ──→ [OPEN]
   ▲                                          │
   └─── (success) ─────────────────────────────┘
```

- **CLOSED**: Use 9Router, route all requests
- **OPEN**: Use fallback provider, check 9Router health periodically
- **Transition to CLOSED**: On successful health check while open

## Task Dependencies

This task (4.1) provides the foundation for:

- Task 4.2: NineRouterProvider implementation
- Task 4.3: AnthropicDirectProvider implementation
- Task 4.4: Health monitoring and circuit breaker
- Task 4.5: Enhanced factory with health-based routing
- Task 4.6: Cost tracking and logging

## Files

- `llm.module.ts`: NestJS module definition
- `llm-provider.factory.ts`: Factory implementation
- `README.md`: This documentation

## Testing

Unit tests are in `llm-provider.factory.spec.ts` and verify:

- Provider instantiation
- Provider caching
- Factory routing logic
- Configuration validation
- Error handling

## Future Enhancements

- Support for additional providers (Claude Direct, GPT-4 Direct)
- Provider-specific configuration (temperature defaults, token limits per provider)
- Metrics collection (latency, error rates by provider)
- A/B testing capabilities for provider selection
- Cost optimization algorithms

## References

- Design Document: `design.md` - Section 2: LLM Gateway Module
- Requirements: `requirements.md` - Requirement 4: LLM Gateway Integration
- Shared Types: `@ai-corp/shared-types` - Agent types module
