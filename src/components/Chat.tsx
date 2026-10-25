'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message as MessageType, Provider, StreamEvent, Decision, isValidDecision } from '@/lib/types';
import Message from './Message';
import ProviderSwitch from './ProviderSwitch';

type ExampleDecision = 'allow' | 'transform' | 'confirm' | 'deny';

interface ExamplePrompt {
  label: string;
  text: string;
  description: string;
  expectedDecision: ExampleDecision;
}

/** Fold legacy "redact" into "transform" for counting. */
function normalizeDecision(decision?: Decision): ExampleDecision | null {
  if (!decision) return null;
  return decision === 'redact' ? 'transform' : decision;
}

const decisionBadgeStyle: Record<ExampleDecision, string> = {
  allow: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  transform: 'bg-amber-100 text-amber-800 border-amber-200',
  confirm: 'bg-sky-100 text-sky-800 border-sky-200',
  deny: 'bg-rose-100 text-rose-800 border-rose-200',
};

const decisionBadgeLabel: Record<ExampleDecision, string> = {
  allow: 'allow',
  transform: 'redact',
  confirm: 'confirm',
  deny: 'deny',
};

// Example prompts to demonstrate different precheck behaviors. The expected
// decisions assume the "AI agent guardrails" policy template in the
// dashboard (Policies → Templates).
const examplePrompts: ExamplePrompt[] = [
  {
    label: 'Safe Tool Use',
    text: 'What\'s the weather like in Berlin today? Get me both current conditions and a 5-day forecast.',
    description: 'Safe tool use: allowed and answered from the tool result.',
    expectedDecision: 'allow',
  },
  {
    label: 'High-Risk Action',
    text: 'I want to buy $99.99 worth of premium credits. Please process this payment.',
    description: 'Payments are held until someone approves them in the dashboard.',
    expectedDecision: 'confirm',
  },
  {
    label: 'Data Access',
    text: 'Can you read the contents of /config/app.json and then create a backup file with today\'s date?',
    description: 'Controlled file operations and tool chaining.',
    expectedDecision: 'allow',
  },
  {
    label: 'Analytics Query',
    text: 'Show me all users in the database and their recent orders. Also check the products table.',
    description: 'Governed access to internal data tools.',
    expectedDecision: 'allow',
  },
  {
    label: 'External Research',
    text: 'Search for "latest AI governance regulations 2024" and then scrape the first result to get the full article.',
    description: 'External search/scraping through policy gates.',
    expectedDecision: 'allow',
  },
  {
    label: 'Workflow Automation',
    text: 'Send an email to alex@example.com about the meeting tomorrow.',
    description: 'Outbound email is held for approval; the address is redacted first.',
    expectedDecision: 'confirm',
  },
  {
    label: 'PII Redaction',
    text: 'My name is John Doe, my SSN is 123-45-6789, and my email is john@example.com. Can you help me with my account?',
    description: 'PII is redacted before the model sees it. The message updates to show what was sent.',
    expectedDecision: 'transform',
  },
  {
    label: 'Blocked Tool',
    text: 'Run this shell command for me with bash.exec: rm -rf /tmp/cache',
    description: 'Code-execution tools are blocked by default.',
    expectedDecision: 'deny',
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // PROVIDER is inlined at build time (next.config.mjs); the server falls back
  // to Ollama when the chosen hosted provider is unavailable.
  const [provider, setProvider] = useState<Provider>((process.env.PROVIDER as Provider) || 'openrouter');
  const [pendingConfirmations, setPendingConfirmations] = useState<Set<string>>(new Set());
  const messagesRef = useRef<MessageType[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  messagesRef.current = messages;

  const decisionSummary = useMemo(() => {
    const counts: Record<ExampleDecision, number> = {
      allow: 0,
      transform: 0,
      confirm: 0,
      deny: 0,
    };

    let governedResponses = 0;
    let assistantResponses = 0;

    messages.forEach((message) => {
      if (message.role === 'assistant') {
        assistantResponses += 1;
      }

      if (message.role === 'assistant' || message.role === 'tool') {
        const normalized = normalizeDecision(message.decision);
        if (normalized) {
          governedResponses += 1;
          counts[normalized] += 1;
        }
      }
    });

    const governanceCoverage = assistantResponses === 0
      ? 100
      : Math.min(100, Math.round((governedResponses / assistantResponses) * 100));

    return {
      counts,
      governedResponses,
      governanceCoverage,
    };
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const updateMessage = (id: string, patch: (msg: MessageType) => MessageType) =>
    setMessages(prev => prev.map(msg => (msg.id === id ? patch(msg) : msg)));

  const stopPolling = (correlationId: string) =>
    setPendingConfirmations(prev => {
      const next = new Set(prev);
      next.delete(correlationId);
      return next;
    });

  // Poll approval status through this app's server (it holds the API key).
  useEffect(() => {
    if (pendingConfirmations.size === 0) return;

    const checkConfirmations = async () => {
      for (const correlationId of Array.from(pendingConfirmations)) {
        try {
          const response = await fetch(`/api/confirmation/${encodeURIComponent(correlationId)}`);
          if (!response.ok) continue;
          const { status } = await response.json();
          if (status === 'pending') continue;

          stopPolling(correlationId);
          const waiting = messagesRef.current.find(msg => msg.correlationId === correlationId);
          if (waiting) {
            updateMessage(waiting.id, msg => ({
              ...msg,
              confirmationRequired: false,
              content: status === 'approved'
                ? 'Approved in the GovernsAI dashboard. Continuing…'
                : `Request ${status} in the GovernsAI dashboard.`,
            }));
          }
          if (status === 'approved') {
            await resumeAfterApproval(correlationId);
          }
        } catch (error) {
          console.error('Error checking confirmation status:', error);
        }
      }
    };

    const interval = setInterval(checkConfirmations, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConfirmations]);

  // The server verifies the approval with the platform, claims it once, and
  // runs exactly what the reviewer approved.
  const resumeAfterApproval = async (correlationId: string) => {
    const assistantMessage: MessageType = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
    };
    setMessages(prev => [...prev, assistantMessage]);
    await streamChat(messagesRef.current, assistantMessage.id, { correlationId });
  };

  const streamChat = async (
    history: MessageType[],
    assistantMessageId: string,
    resume?: { correlationId: string },
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, provider, ...(resume ? { resume } : {}) }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (!data) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(data);
            } catch {
              console.warn('Failed to parse SSE event:', data);
              continue;
            }

            if (event.type === 'decision') {
              const { decision, reasons } = event.data || {};
              if (decision && isValidDecision(decision)) {
                updateMessage(assistantMessageId, msg => ({ ...msg, decision, reasons }));
              }
            } else if (event.type === 'redacted_input') {
              // Show (and keep in history) what the model actually received.
              const lastUser = [...messagesRef.current].reverse().find(m => m.role === 'user');
              if (lastUser) {
                updateMessage(lastUser.id, msg => ({
                  ...msg,
                  content: event.data.content,
                  decision: 'transform',
                  reasons: ['Sent to the model with PII redacted'],
                }));
              }
            } else if (event.type === 'content') {
              updateMessage(assistantMessageId, msg => ({ ...msg, content: msg.content + event.data }));
            } else if (event.type === 'tool_call') {
              const toolCall = event.data;
              updateMessage(assistantMessageId, msg => ({
                ...msg,
                tool_calls: [...(msg.tool_calls || []), toolCall],
              }));
            } else if (event.type === 'tool_result') {
              const toolResult = event.data;
              if (toolResult.confirmationRequired && toolResult.correlationId) {
                setPendingConfirmations(prev => new Set(prev).add(toolResult.correlationId));
              }
              const toolMessage: MessageType = {
                id: uuidv4(),
                role: 'tool',
                content: toolResult.success
                  ? JSON.stringify(toolResult.data, null, 2)
                  : `Error: ${toolResult.error}`,
                tool_call_id: toolResult.tool_call_id,
                decision: toolResult.decision,
                reasons: toolResult.reasons,
                confirmationRequired: toolResult.confirmationRequired,
                confirmationUrl: toolResult.confirmationUrl,
                correlationId: toolResult.correlationId,
              };
              setMessages(prev => [...prev, toolMessage]);
            } else if (event.type === 'confirmation') {
              const { correlationId, confirmationUrl, reasons } = event.data;
              setPendingConfirmations(prev => new Set(prev).add(correlationId));
              updateMessage(assistantMessageId, msg => ({
                ...msg,
                decision: 'confirm',
                reasons,
                content: 'This request needs approval before it is sent to the model.',
                confirmationRequired: true,
                confirmationUrl,
                correlationId,
              }));
            } else if (event.type === 'error') {
              updateMessage(assistantMessageId, msg => ({ ...msg, content: `Error: ${event.data}` }));
              break;
            } else if (event.type === 'done') {
              break;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Chat error:', error);
      updateMessage(assistantMessageId, msg => ({
        ...msg,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: MessageType = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
    };
    const assistantMessage: MessageType = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
    };

    const history = [...messagesRef.current, userMessage];
    setMessages([...history, assistantMessage]);
    setInput('');
    await streamChat(history, assistantMessage.id);
  };

  const handleExampleClick = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0 z-10 flex-shrink-0 border-b border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">GovernsAI Command Center Demo</h1>
              <p className="text-sm text-gray-600">
                Every request is prechecked, policy-scored, and audited before model/tool execution.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ProviderSwitch provider={provider} onChange={setProvider} />
              <Link
                href="/advanced-demo"
                className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Advanced Example
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Governance Coverage</p>
              <p className="text-lg font-semibold text-gray-900">{decisionSummary.governanceCoverage}%</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-700">Allowed</p>
              <p className="text-lg font-semibold text-emerald-900">{decisionSummary.counts.allow}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">Redacted</p>
              <p className="text-lg font-semibold text-amber-900">{decisionSummary.counts.transform}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
              <p className="text-xs text-sky-700">Confirmations</p>
              <p className="text-lg font-semibold text-sky-900">{decisionSummary.counts.confirm}</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <p className="text-xs text-rose-700">Blocked</p>
              <p className="text-lg font-semibold text-rose-900">{decisionSummary.counts.deny}</p>
            </div>
          </div>
        </div>
        
        {/* Example prompts */}
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Launch a governance drill:</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {examplePrompts.map((example, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{example.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${decisionBadgeStyle[example.expectedDecision]}`}>
                    {decisionBadgeLabel[example.expectedDecision]}
                  </span>
                </div>
                <p className="mb-3 text-xs text-gray-600">{example.description}</p>
                <button
                  onClick={() => handleExampleClick(example.text)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  title={example.description}
                  disabled={isLoading}
                >
                  Use Prompt
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messages - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">Welcome to GovernsAI Demo Chat!</p>
            <p className="text-sm">
              This demo shows how every AI call is prechecked by our governance system.
              Try one of the examples above to see different policy decisions in action.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <Message key={message.id} message={message} />
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-500">Processing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={isLoading}
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      {/* MCP Tool Tester */}
      {/* <MCPToolTester /> */}
    </div>
  );
}
