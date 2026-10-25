import { ChatProvider } from './base';
import { FallbackProvider } from './fallback';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { createOpenRouterProvider, openRouterApiKey } from './openrouter';
import { Provider } from '../types';

const PROVIDERS: Provider[] = ['openrouter', 'openai', 'ollama'];

/** PROVIDER if set, else OpenRouter when a key is configured, else Ollama. */
export function defaultProvider(): Provider {
  const configured = process.env.PROVIDER as Provider | undefined;
  if (configured && PROVIDERS.includes(configured)) return configured;
  return openRouterApiKey() ? 'openrouter' : 'ollama';
}

/** Hosted providers fall back to local Ollama unless OLLAMA_FALLBACK=false. */
function withOllamaFallback(primary: ChatProvider): ChatProvider {
  if (process.env.OLLAMA_FALLBACK === 'false') return primary;
  return new FallbackProvider(primary, () => new OllamaProvider());
}

export function createProvider(provider: Provider): ChatProvider {
  switch (provider) {
    case 'openrouter':
      if (!openRouterApiKey()) {
        if (process.env.OLLAMA_FALLBACK === 'false') {
          throw new Error('OPENROUTER_API_KEY is not set');
        }
        console.warn('OPENROUTER_API_KEY is not set, using Ollama');
        return new OllamaProvider();
      }
      return withOllamaFallback(createOpenRouterProvider());
    case 'openai':
      return withOllamaFallback(new OpenAIProvider());
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
