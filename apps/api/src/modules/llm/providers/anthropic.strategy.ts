import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ILLMProvider } from '@ai-corp/shared-types';
import { ProviderConnection, ProviderKind } from '../../../domain/llm';
import { AnthropicDirectProvider } from '../anthropic-direct.provider';
import { ProviderStrategy, RemoteModel } from './provider-strategy';

/** Anthropic Messages API; models come from `GET {baseUrl}/v1/models` */
@Injectable()
export class AnthropicStrategy implements ProviderStrategy {
  readonly kind = ProviderKind.ANTHROPIC;
  readonly defaultBaseUrl = 'https://api.anthropic.com';

  createClient(connection: ProviderConnection): ILLMProvider {
    return new AnthropicDirectProvider({
      apiKey: connection.apiKey ?? '',
      baseURL: connection.baseUrl || undefined,
      providerName: connection.name,
    });
  }

  async listModels(connection: ProviderConnection): Promise<RemoteModel[]> {
    const base = (connection.baseUrl || this.defaultBaseUrl).replace(/\/v1$/, '');
    const { data } = await axios.get(`${base}/v1/models`, {
      params: { limit: 1000 },
      headers: { 'x-api-key': connection.apiKey ?? '', 'anthropic-version': '2023-06-01' },
      timeout: 15_000,
    });
    return (data?.data ?? []).map((m: any) => ({ modelId: m.id, displayName: m.display_name }));
  }
}
