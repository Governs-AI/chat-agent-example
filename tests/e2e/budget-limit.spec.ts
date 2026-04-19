import { test, expect, sendChatMessage } from './fixtures';

function sseBody(events: Array<{ type: string; data: unknown }>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: {"type":"done"}\n\n';
}

test.describe('Budget limit surfaces a clear UI message', () => {
  test('budget-exceeded block returns a user-visible message in the chat stream', async ({ authed }) => {
    await authed.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: sseBody([
          {
            type: 'decision',
            data: {
              decision: 'block',
              reasons: ['Budget limit exceeded for user (org: local-dev-org)'],
            },
          },
          {
            type: 'error',
            data: 'Request blocked: Budget limit exceeded for user (org: local-dev-org)',
          },
        ]),
      });
    });

    await sendChatMessage(authed, 'Summarise the latest board deck for me.');

    await expect(authed.getByText(/Budget limit exceeded/i)).toBeVisible({ timeout: 15_000 });

    const blockBadge = authed.getByText(/^Block$/i).first();
    await expect(blockBadge).toBeVisible();

    const blockedTile = authed.getByText(/^Blocked$/).locator('..');
    await expect(blockedTile).toContainText(/[1-9]\d*/);

    const reasonHint = blockBadge.locator('..').getByText('info');
    await expect(reasonHint).toHaveAttribute('title', /Budget limit exceeded/i);
  });

  test('chat stays usable after the budget block so the user can adjust scope', async ({ authed }) => {
    await authed.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody([
          { type: 'decision', data: { decision: 'block', reasons: ['Budget limit exceeded'] } },
          { type: 'error', data: 'Request blocked: Budget limit exceeded' },
        ]),
      });
    });

    await sendChatMessage(authed, 'Hello');
    await expect(authed.getByText(/Budget limit exceeded/i)).toBeVisible({ timeout: 15_000 });

    const textarea = authed.getByPlaceholder('Type your message...');
    await expect(textarea).toBeEnabled();
    await expect(authed.getByRole('button', { name: /^Send$/ })).toBeEnabled();
  });
});
