/**
 * QA.4 — Tool-policy violation → chat UI surfaces a blocked / redacted indicator
 *
 * Scope (TASKS.md §QA.4): when a tool invocation the assistant wants to make
 * is denied or redacted by precheck, the governed chat UI must clearly surface
 * that decision to the user. This is distinct from a content-policy block at
 * the chat level (covered by blocked-message.spec.ts / governed-chat.spec.ts):
 * here the chat message itself is allowed, but the downstream tool call is
 * governed separately.
 *
 * Why these tests mock /api/chat:
 *   Triggering a real tool-level deny depends on the LLM choosing to call a
 *   tool in `deny_tools` — which is non-deterministic and fragile against
 *   staging. Mocking the SSE stream pins the exact tool_call / tool_result
 *   events the backend produces on a denial, so the test verifies the UI
 *   contract deterministically. The same pattern is used in budget-limit.spec.ts.
 */

import { test, expect, sendChatMessage } from './fixtures';

function sseBody(events: Array<{ type: string; data: unknown }>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: {"type":"done"}\n\n';
}

test.describe('QA.4 · Tool-policy violation surfaces a blocked / redacted UI indicator', () => {
  test.beforeEach(async ({ authed }) => {
    await expect(
      authed.getByRole('heading', { name: /GovernsAI Command Center Demo/i }),
    ).toBeVisible();
  });

  test('denied tool call renders a red Tool Result bubble with a deny badge and reason', async ({
    authed,
  }) => {
    await authed.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: sseBody([
          // The original chat message is allowed — only the tool call trips policy.
          { type: 'decision', data: { decision: 'allow', reasons: [] } },
          {
            type: 'tool_call',
            data: {
              id: 'call_deny_1',
              type: 'function',
              function: {
                name: 'bash.exec',
                arguments: JSON.stringify({ cmd: 'rm -rf /' }),
              },
            },
          },
          // Tool-level precheck denies the call.
          {
            type: 'decision',
            data: {
              decision: 'deny',
              reasons: ["Tool 'bash.exec' is in the deny list"],
            },
          },
          {
            type: 'tool_result',
            data: {
              tool_call_id: 'call_deny_1',
              success: false,
              error: "Tool call blocked: Tool 'bash.exec' is in the deny list",
              decision: 'deny',
              reasons: ["Tool 'bash.exec' is in the deny list"],
            },
          },
        ]),
      });
    });

    await sendChatMessage(authed, 'Clean up the staging server for me.');

    // User-visible "Tool call blocked:" copy from the tool_result error path.
    await expect(authed.getByText(/Tool call blocked/i)).toBeVisible({ timeout: 15_000 });

    // Tool Result label proves this is a role='tool' message, not the assistant bubble.
    await expect(authed.getByText('Tool Result').first()).toBeVisible();

    // The tool bubble must use the red-on-denied class from Message.tsx.
    // Match by text to avoid picking up the assistant bubble (which also turns
    // red when the streamed decision flips to deny).
    const deniedToolBubble = authed.locator('div.bg-red-100.text-red-900', {
      hasText: /Tool call blocked/i,
    });
    await expect(deniedToolBubble).toBeVisible();

    // Deny badge (DecisionBadge renders capitalised text + 🚫 icon).
    const denyBadge = authed.getByText(/^deny$/i).first();
    await expect(denyBadge).toBeVisible();
    await expect(denyBadge.locator('..')).toContainText('🚫');

    // The reason must be reachable via the hover title on the info hint.
    const reasonHint = denyBadge.locator('..').getByText('info');
    await expect(reasonHint).toHaveAttribute('title', /deny list/i);

    // Blocked stats tile counter must increment (role='tool' + decision='deny' counts as deny).
    const blockedTile = authed.getByText(/^Blocked$/).locator('..');
    await expect(blockedTile).toContainText(/[1-9]\d*/);
  });

  test('chat input stays interactive after a tool-policy block so the user can retry', async ({
    authed,
  }) => {
    await authed.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody([
          { type: 'decision', data: { decision: 'allow', reasons: [] } },
          {
            type: 'tool_call',
            data: {
              id: 'call_deny_2',
              type: 'function',
              function: { name: 'python.exec', arguments: '{}' },
            },
          },
          { type: 'decision', data: { decision: 'deny', reasons: ['denied tool'] } },
          {
            type: 'tool_result',
            data: {
              tool_call_id: 'call_deny_2',
              success: false,
              error: 'Tool call blocked: denied tool',
              decision: 'deny',
              reasons: ['denied tool'],
            },
          },
        ]),
      });
    });

    await sendChatMessage(authed, 'Run some Python for me.');
    await expect(authed.getByText(/Tool call blocked/i)).toBeVisible({ timeout: 15_000 });

    await expect(authed.getByPlaceholder('Type your message...')).toBeEnabled();
    await expect(authed.getByRole('button', { name: /^Send$/ })).toBeEnabled();
  });

  test('redacted tool call shows a Redact badge and increments the Redacted tile', async ({
    authed,
  }) => {
    await authed.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody([
          { type: 'decision', data: { decision: 'allow', reasons: [] } },
          {
            type: 'tool_call',
            data: {
              id: 'call_redact_1',
              type: 'function',
              function: {
                name: 'db_query',
                arguments: JSON.stringify({ sql: 'SELECT email FROM users' }),
              },
            },
          },
          // Tool-level precheck redacts PII but still executes the tool.
          {
            type: 'decision',
            data: {
              decision: 'redact',
              reasons: ['PII:email_address redacted'],
            },
          },
          {
            type: 'tool_result',
            data: {
              tool_call_id: 'call_redact_1',
              success: true,
              data: { rows: [{ email: '[REDACTED]' }] },
              decision: 'redact',
              reasons: ['PII:email_address redacted'],
            },
          },
        ]),
      });
    });

    await sendChatMessage(authed, 'Query the users table and list their emails.');

    // Tool Result message appears with the redacted payload rather than a block error.
    const toolResultLabel = authed.getByText('Tool Result').first();
    await expect(toolResultLabel).toBeVisible({ timeout: 15_000 });
    await expect(authed.getByText(/\[REDACTED\]/)).toBeVisible();

    // The Redact badge (✂ icon, capitalised "Redact") must appear on the tool message.
    const redactBadge = authed.getByText(/^redact$/i).first();
    await expect(redactBadge).toBeVisible();
    await expect(redactBadge.locator('..')).toContainText('✂');

    // Redacted stats tile counter must be non-zero.
    const redactedTile = authed.getByText(/^Redacted$/).locator('..');
    await expect(redactedTile).toContainText(/[1-9]\d*/);

    // The tool bubble should NOT be red — a redact is not a block.
    const redBubble = authed.locator('div.bg-red-100.text-red-900');
    await expect(redBubble).toHaveCount(0);
  });
});
