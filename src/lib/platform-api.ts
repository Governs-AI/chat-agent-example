import { PolicyConfig, ToolConfigMetadata } from './types';
import { getPrecheckApiKey } from './utils';
import { getSDKClient } from './sdk-client';

// Platform API configuration
const PLATFORM_BASE_URL = process.env.PLATFORM_URL || 'http://localhost:3002';

export interface PlatformPolicyResponse {
  policy: PolicyConfig | null;
  toolMetadata: Record<string, ToolConfigMetadata>;
  policyId?: string;
  policyName?: string;
  lastUpdated?: string;
  orgId?: string;
}

export interface AgentToolsResponse {
  agentId: string;
  orgId: string;
  tools: Record<string, ToolConfigMetadata>;
  registeredAt: string;
}

// Fetch policies from the platform via SDK
export async function fetchPoliciesFromPlatform(): Promise<PlatformPolicyResponse> {
  try {
    const client = getSDKClient();
    
    // Use SDK getPolicies method
    const anyClient = client as any;
    let policies = await anyClient.getPolicies();

    policies = policies.policies[0];
    console.log('🧠 Policies:', policies);
    // Warn if no policy found - this should be configured in the platform
    if (!policies) {
      console.error('❌ No policy found in platform database!');
      console.error('   Please create a policy in the platform UI or run: pnpm db:seed');
      console.error('   Blocking all requests for security.');
    }
    
    return {
      policy: policies || null,
      toolMetadata: policies.toolMetadata || {},
      orgId: policies.orgId,
    };
  } catch (error) {
    console.log('🧠 Error:', error);
    console.error('❌ Platform API (SDK) not available - BLOCKING all requests for security');
    if (error instanceof Error) {
      console.error('   Error details:', error.message);
    }
    return {
      policy: null,
      toolMetadata: {},
      orgId: undefined,
    };
  }
}

// Register tools used by this agent (with full metadata)
export async function registerAgentTools(tools: string[]): Promise<AgentToolsResponse | null> {
  try {
    const apiKey = getPrecheckApiKey();

    const response = await fetch(`${PLATFORM_BASE_URL}/api/agents/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: 'demo-chat-agent',
        apiKey: apiKey || '',
        tools,
        metadata: {
          version: '1.0.0',
          environment: 'demo',
          lastSeen: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      console.warn(`Failed to register agent tools: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error registering agent tools:', error);
    return null;
  }
}

// Register tools with full metadata using SDK
export async function registerToolsWithMetadata(toolDefinitions: any[]): Promise<any> {
  try {
    const client = getSDKClient();

    // Import tool metadata
    const { getToolMetadata } = await import('./tool-metadata');

    const toolsToRegister = toolDefinitions.map(tool => {
      const toolName = tool.function?.name || tool.name;
      const localMetadata = getToolMetadata(toolName);

      return {
        type: "function" as const,
        function: {
          name: toolName,
          description: tool.function?.description || tool.description || '',
          parameters: tool.function?.parameters || tool.parameters || {
            type: "object",
            properties: {},
            required: []
          }
        }
      };
    });

    // Use SDK registerTools method
    const anyClient = client as any;
    const result = await anyClient.registerTools(toolsToRegister as any, getPrecheckApiKey());
    console.log('✅ Tools registered with platform via SDK:', result);
    return result;
  } catch (error) {
    console.warn('⚠️  Could not register tools with platform via SDK (service not available)');
    if (error instanceof Error) {
      console.warn('Details:', error.message);
    }
    return null;
  }
}

// Get tool metadata for a specific tool
export function getToolMetadataFromPlatform(
  toolName: string,
  platformToolMetadata: Record<string, ToolConfigMetadata>
): ToolConfigMetadata | undefined {
  return platformToolMetadata[toolName];
}
