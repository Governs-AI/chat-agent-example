import { ChatProvider } from './base';
import { Message, Tool } from '../types';

/**
 * Try the primary provider; if it fails before producing any output (bad
 * key, no credits, network down), stream the same request from the fallback
 * instead. A failure after output has started is passed through, because the
 * user has already seen part of the answer.
 */
export class FallbackProvider implements ChatProvider {
  constructor(
    private primary: ChatProvider,
    private fallback: () => ChatProvider,
  ) {}

  async* stream(messages: Message[], model?: string, tools?: Tool[]): AsyncGenerator<{ type: 'content' | 'tool_call' | 'usage', data: any }> {
    let produced = false;
    try {
      for await (const chunk of this.primary.stream(messages, model, tools)) {
        produced = true;
        yield chunk;
      }
      return;
    } catch (error) {
      if (produced) throw error;
      console.warn(
        `${this.primary.getName()} failed, falling back:`,
        error instanceof Error ? error.message : error,
      );
    }
    // The model name belongs to the primary; the fallback uses its own default.
    yield* this.fallback().stream(messages, undefined, tools);
  }

  getDefaultModel(): string {
    return this.primary.getDefaultModel();
  }

  getName(): string {
    return this.primary.getName();
  }
}
