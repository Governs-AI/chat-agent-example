import { auth } from '@/lib/auth';
import { getConfirmation } from '@/lib/governance';

/**
 * GET /api/confirmation/:correlationId → { status }
 *
 * The browser polls this; the server asks the GovernsAI platform with the
 * integration's API key, which the browser never sees.
 */
export async function GET(
  _request: Request,
  { params }: { params: { correlationId: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const confirmation = await getConfirmation(params.correlationId);
  if (!confirmation) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json({ status: confirmation.status });
}
