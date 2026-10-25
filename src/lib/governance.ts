import { Message, PrecheckResponse } from './types';
import { getPrecheckApiKey } from './utils';

/**
 * Server-side glue between the chat route and the GovernsAI platform:
 * applying transform decisions, and the confirm → approve → consume loop.
 *
 * Everything here runs on the server with the integration's API key; the
 * browser never talks to the platform directly.
 */

const platformUrl = () =>
  process.env.PLATFORM_URL || process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3002';

function platformHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Governs-Key': getPrecheckApiKey() || '',
  };
}

/** Text precheck returned for the request (redacted on transform). */
export function textOut(response: PrecheckResponse): string | undefined {
  const out = (response as any).raw_text_out;
  return typeof out === 'string' ? out : undefined;
}

/**
 * Replace the last user message with precheck's output on transform, so the
 * model only ever sees the redacted text.
 */
export function applyChatTransform(messages: Message[], response: PrecheckResponse): Message[] {
  const redacted = textOut(response);
  if (response.decision !== 'transform' || redacted === undefined) return messages;

  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
  if (lastUserIndex === -1) return messages;
  return messages.map((m, i) => (i === lastUserIndex ? { ...m, content: redacted } : m));
}

/**
 * Tool arguments are prechecked as their JSON text. On transform the
 * redacted JSON is parsed back; placeholders replace string contents, so the
 * JSON stays valid. If it somehow doesn't, the call is refused rather than
 * run with the original arguments.
 */
export function argsAfterPrecheck(
  args: Record<string, any>,
  response: PrecheckResponse,
): { ok: true; args: Record<string, any> } | { ok: false; error: string } {
  if (response.decision !== 'transform') return { ok: true, args };
  const redacted = textOut(response);
  if (redacted === undefined) return { ok: true, args };
  try {
    return { ok: true, args: JSON.parse(redacted) };
  } catch {
    return { ok: false, error: 'Redacted tool arguments were not valid JSON; call refused' };
  }
}

export interface ConfirmationTicket {
  correlationId: string;
  confirmationUrl: string;
  approvalsUrl?: string;
}

/** Hold a request for human approval; reuses precheck's correlation id. */
export async function requestConfirmation(input: {
  correlationId: string;
  requestType: 'chat' | 'tool_call';
  requestDesc: string;
  requestPayload: Record<string, any>;
  reasons?: string[];
}): Promise<ConfirmationTicket> {
  const res = await fetch(`${platformUrl()}/api/v1/confirmation/create`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ ...input, decision: 'confirm', reasons: input.reasons || [] }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `confirmation create failed (${res.status})`);
  }
  const body = await res.json();
  return {
    correlationId: body.confirmation.correlationId,
    confirmationUrl:
      body.confirmationUrl || `${platformUrl()}/confirm/${body.confirmation.correlationId}`,
    approvalsUrl: body.approvalsUrl,
  };
}

export interface ConfirmationStatus {
  status: string;
  requestType: string;
  requestPayload: Record<string, any>;
}

export async function getConfirmation(correlationId: string): Promise<ConfirmationStatus | null> {
  const res = await fetch(
    `${platformUrl()}/api/v1/confirmation/${encodeURIComponent(correlationId)}`,
    { headers: platformHeaders(), cache: 'no-store' },
  );
  if (!res.ok) return null;
  const body = await res.json();
  return {
    status: body.confirmation.status,
    requestType: body.confirmation.requestType,
    requestPayload: body.confirmation.requestPayload || {},
  };
}

/**
 * Claim an approval for exactly one execution. Returns the approved payload,
 * or null when it is not (or no longer) approved — e.g. already used.
 */
export async function consumeApproval(correlationId: string): Promise<ConfirmationStatus | null> {
  const current = await getConfirmation(correlationId);
  if (!current || current.status !== 'approved') return null;

  const res = await fetch(
    `${platformUrl()}/api/v1/confirmation/${encodeURIComponent(correlationId)}/consume`,
    { method: 'POST', headers: platformHeaders() },
  );
  if (!res.ok) return null;
  return { ...current, status: 'consumed' };
}
