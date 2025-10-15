import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getSDKClient } from '@/lib/sdk-client';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, contentType, metadata, conversationId, correlationId, scope, visibility } = body || {};

    if (!content || !contentType) {
      return Response.json({ error: 'content and contentType are required' }, { status: 400 });
    }

    const user = session.user as any;
    const userId = user.governs_user_id || user.id;
    const orgId = user.org_id;

    const client: any = getSDKClient();

    // Use SDK storeContext method
    const result = await client.storeContext({
      content,
      contentType,
      agentId: 'demo-chat-agent',
      conversationId,
      correlationId,
      metadata: { ...metadata, userId, orgId },
      scope: scope || 'user',
      visibility: visibility || 'private',
    });
    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}


