import { OpenAIProvider } from './openai';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
// Cheap, fast and reliable at tool calling (~$0.10 / $0.40 per 1M tokens).
export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4.1-nano';

/** OPENROUTER_API_KEY, or OPEN_ROUTER_API_KEY as some shared .env files spell it. */
export function openRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || undefined;
}

export function createOpenRouterProvider(): OpenAIProvider {
  return new OpenAIProvider({
    name: 'openrouter',
    apiKey: openRouterApiKey() || '',
    baseURL: process.env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
    defaultModel: process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL,
    // Optional attribution headers OpenRouter shows in its dashboard.
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3004',
      'X-Title': 'GovernsAI Chat Agent',
    },
  });
}
