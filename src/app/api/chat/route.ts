import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { precheck, createChatPrecheckRequest, createMCPPrecheckRequest, fetchBudgetContext } from '@/lib/precheck';
import { ChatProvider } from '@/lib/providers/base';
import { createProvider, defaultProvider } from '@/lib/providers';
import { SSEWriter } from '@/lib/sse';
import { ChatRequest, Provider, Message, ToolCall } from '@/lib/types';
import { AVAILABLE_TOOLS } from '@/lib/tools';
import { getSDKClient, searchMemoryContext, getRecentMemoryContext } from '@/lib/sdk-client';
import {
  applyChatTransform,
  argsAfterPrecheck,
  consumeApproval,
  requestConfirmation,
  textOut,
} from '@/lib/governance';
import { auth } from '@/lib/auth';

// Intent detector to decide which tools (if any) should be enabled
function detectToolIntent(userText: string): string[] {
  const text = (userText || '').toLowerCase();
  const wantsWeather = /(weather|temperature|forecast|rain|snow|wind|humidity)/.test(text);
  const wantsWeb = /(search|google|lookup|web|scrape|crawl)/.test(text);
  const wantsFile = /(read file|write file|save to file|open file|file\s+(read|write|list))/.test(text);
  const wantsDb = /(query|database|sql|select|insert|update|delete)\b/.test(text);
  const wantsPayment = /(pay|payment|charge|refund|checkout|transaction)/.test(text);
  const wantsEmail = /(send email|email to|compose email|send an email|email)/.test(text);
  const wantsCalendar = /(calendar|schedule|event|meeting)/.test(text);

  const toolNames: string[] = [];
  if (wantsWeather) toolNames.push('weather_current', 'weather_forecast');
  if (wantsWeb) toolNames.push('web_search', 'web_scrape');
  if (wantsFile) toolNames.push('file_read', 'file_write', 'file_list');
  if (wantsDb) toolNames.push('db_query');
  if (wantsPayment) toolNames.push('payment_process', 'payment_refund');
  if (wantsEmail) toolNames.push('email_send');
  if (wantsCalendar) toolNames.push('calendar_create_event');
  return toolNames;
}

// Helper function to record usage after AI call using SDK
async function recordUsage(
  userId: string,
  orgId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  tool?: string,
  correlationId?: string,
) {
  try {
    const client = getSDKClient();

    // Calculate cost (simplified calculation - in real app, use proper cost calculation)
    const cost = (inputTokens * 0.0001) + (outputTokens * 0.0002);

    await client.recordUsage({
      userId,
      orgId,
      provider,
      model,
      inputTokens,
      outputTokens,
      cost,
      costType: 'external',
      tool: tool || 'chat',
      correlationId,
    });
  } catch (error) {
    console.error('Failed to record usage via SDK:', error);
    // Don't throw - usage recording failure shouldn't break the chat
  }
}

async function runTool(name: string, args: Record<string, any>) {
  const { mockTools } = await import('@/lib/mock-tools');
  const toolFunction = mockTools[name as keyof typeof mockTools];
  if (!toolFunction) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return toolFunction(args as any);
}

interface ExecutedTool {
  toolCall: ToolCall;
  result: unknown;
}

/**
 * Precheck a tool call's arguments, then run it, refuse it, or hold it for
 * approval. Returns the executed call so the model can use its result.
 */
async function executeToolCall(
  toolCall: ToolCall,
  writer: SSEWriter,
  userId: string,
  budgetContext?: any,
): Promise<ExecutedTool | null> {
  const name = toolCall.function.name;
  let args: Record<string, any>;
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    writer.writeToolResult({
      tool_call_id: toolCall.id,
      success: false,
      error: 'Tool arguments were not valid JSON',
    });
    return null;
  }

  try {
    const corrId = uuidv4();
    const precheckResponse = await precheck(
      createMCPPrecheckRequest(name, args, corrId, undefined, undefined, budgetContext),
      userId,
    );

    writer.writeDecision(precheckResponse.decision, precheckResponse.reasons);

    if (precheckResponse.decision === 'deny') {
      const reasons = (precheckResponse.reasons || []).filter(
        (reason) =>
          !reason.includes('Precheck service') &&
          !reason.includes('connection failed') &&
          !reason.includes('service not available'),
      );
      writer.writeToolResult({
        tool_call_id: toolCall.id,
        success: false,
        error: `Tool call blocked: ${reasons.join(', ') || 'Policy violation'}`,
        decision: precheckResponse.decision,
        reasons: precheckResponse.reasons,
      });
      return null;
    }

    if (precheckResponse.decision === 'confirm') {
      // Hold the exact call for review; on approval the same args run.
      const ticket = await requestConfirmation({
        correlationId: corrId,
        requestType: 'tool_call',
        requestDesc: `Run ${name}`,
        requestPayload: { tool: name, args, toolCallId: toolCall.id },
        reasons: precheckResponse.reasons,
      });
      writer.writeToolResult({
        tool_call_id: toolCall.id,
        success: false,
        error: 'Waiting for approval',
        decision: precheckResponse.decision,
        reasons: precheckResponse.reasons,
        confirmationRequired: true,
        correlationId: ticket.correlationId,
        confirmationUrl: ticket.confirmationUrl,
      });
      return null;
    }

    const processed = argsAfterPrecheck(args, precheckResponse);
    if (!processed.ok) {
      writer.writeToolResult({
        tool_call_id: toolCall.id,
        success: false,
        error: processed.error,
        decision: 'deny',
      });
      return null;
    }

    const data = await runTool(name, processed.args);
    writer.writeToolResult({
      tool_call_id: toolCall.id,
      success: true,
      data,
      error: (data as any)?.error,
      decision: precheckResponse.decision,
      reasons: precheckResponse.reasons,
    });
    return {
      toolCall: { ...toolCall, function: { name, arguments: JSON.stringify(processed.args) } },
      result: data,
    };
  } catch (error) {
    writer.writeToolResult({
      tool_call_id: toolCall.id,
      success: false,
      error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return null;
  }
}

/** Feed executed tool results back to the model for a final answer. */
async function streamFollowUp(
  chatProvider: ChatProvider,
  model: string,
  messages: Message[],
  executed: ExecutedTool[],
  writer: SSEWriter,
) {
  const followUp: Message[] = [
    ...messages,
    {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      tool_calls: executed.map((e) => e.toolCall),
    },
    ...executed.map((e) => ({
      id: uuidv4(),
      role: 'tool' as const,
      content: JSON.stringify(e.result),
      tool_call_id: e.toolCall.id,
    })),
  ];
  for await (const chunk of chatProvider.stream(followUp, model)) {
    if (chunk.type === 'content') writer.writeContent(chunk.data);
  }
}

/** Only plain user/assistant turns are replayed to the model. */
function conversationOnly(messages: Message[]): Message[] {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(({ id, role, content }) => ({ id, role, content }));
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();

    if (!session?.user) {
      return Response.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    // Extract user context from session
    const user = session.user as any;
    const userId = (user.governs_user_id || user.id || '') as string;
    const orgId = (user.org_id || process.env.GOVERNS_ORG_ID || '') as string;

    const body: ChatRequest = await request.json();
    const { messages, model, provider: requestProvider, resume } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const provider: Provider = requestProvider || defaultProvider();
    const corrId = uuidv4();

    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream({
      start(ctrl) {
        controller = ctrl;
      },
    });
    const writer = new SSEWriter(controller!);

    // Handle the streaming in the background
    (async () => {
      try {
        let chatProvider: ChatProvider;
        try {
          chatProvider = createProvider(provider);
        } catch (error) {
          writer.writeError(
            `Provider initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          return;
        }
        const modelToUse = model || chatProvider.getDefaultModel();
        const history = conversationOnly(messages);

        // ── Resume an approved request ──────────────────────────────────
        // The platform is the only source of truth for approval: the
        // approval is claimed (consumed) once, and exactly the payload the
        // reviewer saw is executed.
        if (resume?.correlationId) {
          const approval = await consumeApproval(resume.correlationId);
          if (!approval) {
            writer.writeError('This request is not approved, has expired, or was already used.');
            return;
          }
          writer.writeDecision('allow', ['confirmation.approved']);

          if (approval.requestType === 'tool_call') {
            const { tool, args, toolCallId } = approval.requestPayload as {
              tool: string;
              args: Record<string, any>;
              toolCallId?: string;
            };
            const toolCall: ToolCall = {
              id: toolCallId || `call_${uuidv4()}`,
              type: 'function',
              function: { name: tool, arguments: JSON.stringify(args) },
            };
            writer.writeToolCall(toolCall);
            const data = await runTool(tool, args);
            writer.writeToolResult({
              tool_call_id: toolCall.id,
              success: true,
              data,
              decision: 'allow',
              reasons: ['confirmation.approved'],
            });
            await streamFollowUp(chatProvider, modelToUse, history, [{ toolCall, result: data }], writer);
          } else {
            const approvedMessages = conversationOnly(
              (approval.requestPayload.messages as Message[]) || history,
            );
            for await (const chunk of chatProvider.stream(approvedMessages, modelToUse)) {
              if (chunk.type === 'content') writer.writeContent(chunk.data);
            }
          }
          writer.writeDone();
          return;
        }

        // ── Normal turn ─────────────────────────────────────────────────
        const budgetContext = await fetchBudgetContext(userId, orgId);

        const precheckRequest = createChatPrecheckRequest(history, provider, corrId);
        precheckRequest.budget_context = budgetContext;
        const precheckResponse = await precheck(precheckRequest, userId);

        writer.writeDecision(precheckResponse.decision, precheckResponse.reasons);

        if (precheckResponse.decision === 'deny') {
          writer.writeError(
            `Request blocked: ${precheckResponse.reasons?.join(', ') || 'Policy violation'}`
          );
          return;
        }

        if (precheckResponse.decision === 'confirm') {
          const ticket = await requestConfirmation({
            correlationId: corrId,
            requestType: 'chat',
            requestDesc: 'Send a chat message to the model',
            requestPayload: { messages: history },
            reasons: precheckResponse.reasons,
          });
          writer.writeConfirmation({ ...ticket, reasons: precheckResponse.reasons });
          writer.writeDone();
          return;
        }

        // The model only ever sees precheck's output for this turn.
        const processedMessages = applyChatTransform(history, precheckResponse);
        if (precheckResponse.decision === 'transform') {
          const redacted = textOut(precheckResponse);
          if (redacted !== undefined) writer.writeRedactedInput(redacted);
        }

        // Search for relevant memory context before sending to AI (LLM-compressed)
        let memoryContext = '';
        try {
          const lastUserMessage = processedMessages.filter((m) => m.role === 'user').slice(-1)[0];
          if (lastUserMessage?.content) {
            const search = await searchMemoryContext(lastUserMessage.content, userId, 5);
            const recent = await getRecentMemoryContext(userId, 3);
            const contexts: string[] = [];
            if (search?.success && search?.context) contexts.push(search.context);
            if (recent?.success && recent?.context) contexts.push(recent.context);
            if (contexts.length > 0) {
              memoryContext = `\n\nContext memory (summarized):\n${contexts.join('\n')}`;
            }
          }
        } catch (error) {
          console.warn('Memory search failed:', error);
        }

        let usageData: { inputTokens: number; outputTokens: number } | null = null;

        // Disable tools by default. Enable only when clear intent is detected.
        const lastUserMsg = processedMessages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
        const intendedToolNames = detectToolIntent(lastUserMsg);
        const tools = AVAILABLE_TOOLS.filter((t) => intendedToolNames.includes(t.function.name));

        const systemMessage: Message = {
          id: uuidv4(),
          role: 'system',
          content: `You are a helpful assistant. Do NOT use tools unless strictly necessary to answer correctly. Prefer direct answers using your own knowledge. If a tool is required (e.g., weather, web search, file ops, payments, db, email, calendar), call exactly one appropriate tool with minimal parameters, otherwise answer directly. Placeholders such as <USER_EMAIL> mean a value was redacted by governance policy; use the placeholder as-is.${memoryContext}`,
        };
        const modelMessages = [systemMessage, ...processedMessages];

        const executed: ExecutedTool[] = [];
        for await (const chunk of chatProvider.stream(modelMessages, modelToUse, tools)) {
          if (chunk.type === 'content') {
            writer.writeContent(chunk.data);
          } else if (chunk.type === 'tool_call') {
            const toolCall = chunk.data as ToolCall;
            writer.writeToolCall(toolCall);
            const ran = await executeToolCall(toolCall, writer, userId, budgetContext);
            if (ran) executed.push(ran);
          } else if (chunk.type === 'usage') {
            usageData = {
              inputTokens: chunk.data.prompt_tokens || 0,
              outputTokens: chunk.data.completion_tokens || 0,
            };
          }
        }

        if (executed.length > 0) {
          await streamFollowUp(chatProvider, modelToUse, modelMessages, executed, writer);
        }

        writer.writeDone();

        if (usageData && userId && orgId) {
          await recordUsage(
            userId,
            orgId,
            chatProvider.getName(),
            modelToUse,
            usageData.inputTokens,
            usageData.outputTokens,
            'chat',
            corrId,
          );
        }
      } catch (error) {
        writer.writeError(
          `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        writer.close();
      }
    })();

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
