import { GovernsAIClient } from "@governs-ai/sdk";
import { getPrecheckUserIdDetails } from './utils';

// Create SDK client instance
let sdkClient: GovernsAIClient | null = null;

export function getSDKClient(): GovernsAIClient {
    if (!sdkClient) {
        // Get user details for dynamic userId
        const { apiKey } = getPrecheckUserIdDetails();

        // Create client with explicit configuration (Platform base URL per SDK spec)
        sdkClient = new GovernsAIClient({
            apiKey: apiKey,
            baseUrl: process.env.PRECHECK_URL || 'http://localhost:3002',
            orgId: process.env.DEMO_ORG_ID || 'cmg83v4ki00005q6app5ouwrw', // Use seeded org ID
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
        });
    }

    return sdkClient;
}

// Helper to get client for specific user (for dynamic userId scenarios)
export function getSDKClientForUser(userId: string, apiKey?: string): GovernsAIClient {
    const { apiKey: defaultApiKey } = getPrecheckUserIdDetails();

    return new GovernsAIClient({
        apiKey: apiKey || defaultApiKey,
        baseUrl: process.env.PRECHECK_URL || 'http://localhost:3002',
        orgId: process.env.DEMO_ORG_ID || 'cmg83v4ki00005q6app5ouwrw',
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
    });
}

// Test connection helper
export async function testSDKConnection(): Promise<boolean> {
    try {
        const client = getSDKClient();
        // Use a lightweight call available in current SDK build (fallback)
        await client.precheckRequest({
            tool: 'health.check',
            scope: 'net.external',
            raw_text: 'ping',
          } as any, 'health-user');
        return true;
    } catch (error) {
        console.error('SDK connection test failed:', error);
        return false;
    }
}
