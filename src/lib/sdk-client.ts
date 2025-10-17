import { GovernsAIClient } from "@governs-ai/sdk";
import { getPrecheckApiKey } from './utils';

// Create SDK client instance
let sdkClient: GovernsAIClient | null = null;

export function getSDKClient(): GovernsAIClient {
    if (!sdkClient) {
        // Get user details for dynamic userId
        const apiKey = getPrecheckApiKey();

        // Create client with explicit configuration (Platform base URL per SDK spec)
        sdkClient = new GovernsAIClient({
            apiKey: apiKey || '',
            baseUrl: process.env.PLATFORM_URL || '',
            precheckBaseUrl: process.env.GOVERNS_PRECHECK_BASE_URL || '',
            orgId: process.env.GOVERNS_ORG_ID || '', // Use seeded org ID
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
        });
    }
    return sdkClient;
}

// Search memory context using SDK
export async function searchMemoryContext(query: string, _userId: string, limit: number = 5): Promise<any> {
    try {
        const client = getSDKClient();
        
        // Use SDK LLM-optimized search
        const anyClient = client as any;
        const results = await anyClient.searchContextLLM({
            query,
            limit,
            scope: 'user',
        });
        return results;
    } catch (error) {
        console.warn('Memory search error:', error);
        return { success: false, context: '', memoryCount: 0 };
    }
}

// Get recent memory context
export async function getRecentMemoryContext(_userId: string, limit: number = 3): Promise<any> {
    try {
        const client = getSDKClient();
        const anyClient = client as any;
        // Use a wildcard query for recent in LLM format
        const results = await anyClient.searchContextLLM({
            query: '*',
            limit,
            scope: 'user',
        });
        return results;
    } catch (error) {
        console.warn('Recent memory error:', error);
        return { success: false, context: '', memoryCount: 0 };
    }
}
