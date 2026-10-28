/**
 * Models offered before any provider is configured in the app, and imported with the
 * 9Router provider created from NINE_ROUTER_URL on first start.
 */
export const NINE_ROUTER_DEFAULT_MODELS: Array<{ modelId: string; displayName: string; category: string }> = [
  { modelId: 'openrouter/openrouter/free', displayName: 'OpenRouter Free', category: 'general' },
  { modelId: 'openrouter/openrouter/owl-alpha', displayName: 'OWL Alpha', category: 'general' },
  { modelId: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', displayName: 'Nemotron 3 Super 120B', category: 'general' },
  { modelId: 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free', displayName: 'Nemotron 3 Ultra 550B', category: 'general' },
  { modelId: 'openrouter/poolside/laguna-xs.2:free', displayName: 'Laguna XS', category: 'code' },
  { modelId: 'openrouter/poolside/laguna-m.1:free', displayName: 'Laguna M', category: 'code' },
  { modelId: 'openrouter/cohere/north-mini-code:free', displayName: 'North Mini Code', category: 'code' },
  { modelId: 'openrouter/google/gemma-4-31b-it:free', displayName: 'Gemma 4 31B', category: 'general' },
  { modelId: 'openrouter/google/gemma-4-26b-a4b-it:free', displayName: 'Gemma 4 26B', category: 'general' },
  { modelId: 'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', displayName: 'Nemotron 3 Nano Omni', category: 'reasoning' },
  { modelId: 'openrouter/nvidia/nemotron-3-nano-30b-a3b:free', displayName: 'Nemotron 3 Nano', category: 'general' },
  { modelId: 'openrouter/nex-agi/nex-n2-pro:free', displayName: 'NEX N2 Pro', category: 'general' },
  { modelId: 'cx/gpt-5.5', displayName: 'GPT-5.5', category: 'premium' },
  { modelId: 'cx/gpt-5.4', displayName: 'GPT-5.4', category: 'premium' },
  { modelId: 'cx/gpt-5.4-mini', displayName: 'GPT-5.4 Mini', category: 'general' },
  { modelId: 'ds/deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', category: 'general' },
  { modelId: 'ds/deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', category: 'general' },
  { modelId: 'groq/llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B', category: 'general' },
  { modelId: 'groq/qwen/qwen3-32b', displayName: 'Qwen 3 32B', category: 'general' },
];

export const NINE_ROUTER_PROVIDER_NAME = '9Router';
