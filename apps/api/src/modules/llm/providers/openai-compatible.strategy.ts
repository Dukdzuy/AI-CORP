import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { ILLMProvider } from '@ai-corp/shared-types';
import { ProviderConnection, ProviderKind } from '../../../domain/llm';
import { NineRouterProvider } from '../nine-router-provider';
import { ProviderStrategy, RemoteModel } from './provider-strategy';

/** Gateways such as Ollama accept any key; the OpenAI client still needs one */
const NO_KEY = 'not-needed';

/**
 * OpenAI protocol: 9Router, OpenAI, OpenRouter, Groq, DeepSeek, Ollama, LM Studio...
 * Chat goes through NineRouterProvider (an OpenAI client with retries); models come
 * from `GET {baseUrl}/models`.
 */
@Injectable()
export class OpenAICompatibleStrategy implements ProviderStrategy {
  readonly kind = ProviderKind.OPENAI_COMPATIBLE;
  readonly defaultBaseUrl = 'https://api.openai.com/v1';

  createClient(connection: ProviderConnection): ILLMProvider {
    return new NineRouterProvider(connection.baseUrl || this.defaultBaseUrl, connection.apiKey || NO_KEY, connection.name);
  }

  async listModels(connection: ProviderConnection): Promise<RemoteModel[]> {
    const client = new OpenAI({ baseURL: connection.baseUrl || this.defaultBaseUrl, apiKey: connection.apiKey || NO_KEY, timeout: 15_000, maxRetries: 0 });
    const models: RemoteModel[] = [];
    for await (const model of client.models.list()) {
      models.push({ modelId: model.id, displayName: (model as any).name });
    }
    return models;
  }
}
