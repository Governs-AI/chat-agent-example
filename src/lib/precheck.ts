import { PrecheckRequest, PrecheckResponse } from './types';
import { getPrecheckUserIdDetails } from './utils';
import { getSDKClient, getSDKClientForUser } from './sdk-client';
import { GovernsAIError, PrecheckError as SDKPrecheckError, PrecheckRequest as SDKPrecheckRequest, PrecheckResponse as SDKPrecheckResponse } from '@governs-ai/sdk';

export class PrecheckError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'PrecheckError';
  }
}

// Helper function to fetch budget context using SDK
export async function fetchBudgetContext(apiKey?: string): Promise<any> {
  try {
    const client = getSDKClient();
    const { userId } = getPrecheckUserIdDetails();
    const budgetContext = await client.getBudgetContext(userId);
    return budgetContext;
  } catch (error) {
    console.warn('Error fetching budget context via SDK, using mock data for testing:', error);
    // Return mock budget context for testing
    return {
      monthly_limit: 1000.00,
      current_spend: 0.00,
      llm_spend: 0.00,
      purchase_spend: 0.00,
      remaining_budget: 1000.00,
      budget_type: 'user'
    };
  }
}

export async function precheck(
  input: PrecheckRequest,
  userId?: string,
  apiKey?: string
): Promise<PrecheckResponse> {
  try {
    // Use SDK client for precheck
    const client = userId ? getSDKClientForUser(userId, apiKey) : getSDKClient();
    const finalUserId = userId || getPrecheckUserIdDetails().userId;

    // Convert local types to SDK types
    const sdkRequest: SDKPrecheckRequest = {
      tool: input.tool,
      scope: input.scope,
      raw_text: input.raw_text,
      payload: input.payload,
      tags: input.tags,
      corr_id: input.corr_id,
      policy_config: input.policy_config as any, // Type assertion for compatibility
      tool_config: input.tool_config as any, // Type assertion for compatibility
      budget_context: input.budget_context,
    };

    const sdkResponse = await client.precheckRequest(sdkRequest, finalUserId);

    // Convert SDK response back to local types
    const response: PrecheckResponse = {
      decision: sdkResponse.decision as any, // Type assertion for compatibility
      content: sdkResponse.content,
      reasons: sdkResponse.reasons,
      pii_findings: sdkResponse.pii_findings,
      metadata: sdkResponse.metadata,
    };

    return response;
  } catch (error) {
    // Handle SDK errors
    if (error instanceof SDKPrecheckError) {
      console.error('⛔ SDK Precheck failed:', error.message);
      return {
        decision: 'block',
        content: {
          messages: input.payload?.messages || [],
          args: input.payload?.args || input.payload || {}
        },
        reasons: [`Precheck failed: ${error.message}`],
        pii_findings: [],
        metadata: {
          mock: true,
          error: error.message,
          errorType: 'sdk_precheck_error'
        }
      } as PrecheckResponse;
    } else if (error instanceof GovernsAIError) {
      console.error('⛔ GovernsAI SDK error:', error.message);
      return {
        decision: 'block',
        content: {
          messages: input.payload?.messages || [],
          args: input.payload?.args || input.payload || {}
        },
        reasons: [`SDK error: ${error.message}`],
        pii_findings: [],
        metadata: {
          mock: true,
          error: error.message,
          errorType: 'sdk_error'
        }
      } as PrecheckResponse;
    }

    // Handle other errors - BLOCK for security
    console.error('⛔ Precheck service connection failed - BLOCKING request for security');
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    return {
      decision: 'block',
      content: {
        messages: input.payload?.messages || [],
        args: input.payload?.args || input.payload || {}
      },
      reasons: ['Precheck service connection failed - request blocked for security'],
      pii_findings: [],
      metadata: {
        mock: true,
        error: error instanceof Error ? error.message : 'Network error',
        errorType: 'connection_failed'
      }
    } as PrecheckResponse;
  }
}

// Helper function to create a precheck request for chat messages
export function createChatPrecheckRequest(
  messages: any[],
  provider: string,
  corrId?: string,
  policyConfig?: any,
  toolConfig?: any
): PrecheckRequest {
  // Only send the last user message for precheck, not the entire conversation history
  // This prevents old blocked messages from affecting new requests
  const lastUserMessage = messages
    .filter(msg => msg.role === 'user')
    .slice(-1)[0]; // Get only the last user message

  const rawText = lastUserMessage?.content || '';

  return {
    tool: 'model.chat',
    scope: 'net.external',
    raw_text: rawText,
    payload: {
      messages,
      provider,
    },
    tags: ['demo', 'chat'],
    corr_id: corrId,
    policy_config: policyConfig,
    tool_config: toolConfig,
  };
}

// Helper function to create a precheck request for MCP calls
export function createMCPPrecheckRequest(
  tool: string,
  args: Record<string, any>,
  corrId?: string,
  policyConfig?: any,
  toolConfig?: any,
  budgetContext?: any
): PrecheckRequest {
  // Create a raw_text representation of the MCP call for precheck
  const rawText = `MCP Tool Call: ${tool} with arguments: ${JSON.stringify(args)}`;

  // Extract purchase amount from args for payment tools
  let enhancedToolConfig = { ...toolConfig };
  if (tool === 'payment_process' && args.amount) {
    enhancedToolConfig = {
      ...toolConfig,
      metadata: {
        ...toolConfig?.metadata,
        purchase_amount: Number(args.amount), // ← Extract purchase amount
        amount: Number(args.amount),
        currency: args.currency || 'USD',
        description: args.description || 'Payment transaction',
      }
    };
  }

  return {
    tool: tool, // Use the actual tool name, not "mcp.${tool}"
    scope: enhancedToolConfig?.scope || 'net.external',
    raw_text: rawText,
    payload: {
      tool,
      args,
    },
    tags: ['demo', 'mcp'],
    corr_id: corrId,
    policy_config: policyConfig,
    tool_config: enhancedToolConfig,
    budget_context: budgetContext, // ← Add budget context
  };
}
