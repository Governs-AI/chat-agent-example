import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { precheck, createMCPPrecheckRequest, fetchBudgetContext } from '@/lib/precheck';
import { MCPRequest, MCPResponse } from '@/lib/types';
import { mockTools } from '@/lib/mock-tools';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    
    if (!session?.user) {
      return Response.json(
        { success: false, error: 'Unauthorized - please login' } as MCPResponse,
        { status: 401 }
      );
    }

    // Extract user context from session
    const user = session.user as any;
    const userId = user.governs_user_id || user.id;
    const apiKey = process.env.PRECHECK_API_KEY; // Use server-side API key

    const body: MCPRequest = await request.json();
    const { tool, args } = body;

    if (!tool) {
      return Response.json(
        { success: false, error: 'Tool name is required' } as MCPResponse,
        { status: 400 }
      );
    }

    const corrId = uuidv4();

    // Step 1: Fetch budget context and precheck the MCP call
    const budgetContext = await fetchBudgetContext(apiKey);

    const precheckRequest = createMCPPrecheckRequest(tool, args || {}, corrId, undefined, undefined, budgetContext);

    try {
      const precheckResponse = await precheck(precheckRequest, userId);

      // Step 2: Handle precheck decision
      if (precheckResponse.decision === 'block') {
        return Response.json({
          success: false,
          error: 'MCP call blocked by policy',
          decision: precheckResponse.decision,
          reasons: precheckResponse.reasons,
        } as MCPResponse, { status: 403 });
      }

      // For confirm decision, we mock-approve (no actual UI confirmation in demo)
      if (precheckResponse.decision === 'confirm') {
        console.log(`Mock-confirming MCP call: ${tool} with args:`, args);
      }

      // Use possibly modified args from precheck response
      const processedArgs = precheckResponse.content?.args || args || {};

      // Step 3: Execute the MCP tool (mock implementation)
      const toolFunction = mockTools[tool as keyof typeof mockTools];

      if (!toolFunction) {
        return Response.json({
          success: false,
          error: `Unknown tool: ${tool}`,
          decision: precheckResponse.decision,
          reasons: precheckResponse.reasons,
        } as MCPResponse, { status: 400 });
      }

      const result = await toolFunction(processedArgs);

      return Response.json({
        success: true,
        data: result,
        decision: precheckResponse.decision,
        reasons: precheckResponse.reasons,
      } as MCPResponse);

    } catch (precheckError) {
      console.error('Precheck failed for MCP call:', precheckError);

      return Response.json({
        success: false,
        error: 'Precheck service unavailable',
        details: precheckError instanceof Error ? precheckError.message : 'Unknown error',
      } as MCPResponse, { status: 503 });
    }

  } catch (error) {
    console.error('MCP API error:', error);
    return Response.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      } as MCPResponse,
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return available tools with detailed descriptions
  const toolDescriptions = {
    'weather_current': 'Get current weather conditions using latitude and longitude coordinates',
    'weather_forecast': 'Get weather forecast for multiple days using coordinates',
    'payment_process': 'Process a payment transaction',
    'payment_refund': 'Process a refund for a transaction',
    'db_query': 'Execute database queries on mock tables',
    'file_read': 'Read contents of a file',
    'file_write': 'Write content to a file',
    'file_list': 'List files and directories',
    'web_search': 'Search the web for information using Firecrawl API',
    'web_scrape': 'Scrape and extract content from webpages using Firecrawl API',
    'email_send': 'Send an email message',
    'calendar_create_event': 'Create a calendar event',
    'kv_get': 'Get value from key-value store',
    'kv_set': 'Set value in key-value store',
  };

  return Response.json({
    tools: Object.keys(mockTools).map(tool => ({
      name: tool,
      description: toolDescriptions[tool as keyof typeof toolDescriptions] || `Mock implementation of ${tool}`,
      category: tool.split('.')[0],
    })),
    categories: {
      weather: ['weather_current', 'weather_forecast'],
      payment: ['payment_process', 'payment_refund'],
      db: ['db_query'],
      file: ['file_read', 'file_write', 'file_list'],
      web: ['web_search', 'web_scrape'],
      email: ['email_send'],
      calendar: ['calendar_create_event'],
      kv: ['kv_get', 'kv_set'],
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
