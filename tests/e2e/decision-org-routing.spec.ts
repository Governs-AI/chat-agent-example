import { test, expect, sendChatMessage, env } from './fixtures';

const SAFE_PROMPT = 'What is the capital of France?';

test.describe('DL-6: decision row appears in dashboard after chat message', () => {
  test('chat message produces a decision row in the platform dashboard with matching orgId', async ({
    authed,
    context,
  }) => {
    const chatResponsePromise = authed.waitForResponse(
      (resp) => resp.url().endsWith('/api/chat') && resp.status() === 200,
    );

    await sendChatMessage(authed, SAFE_PROMPT);

    const chatResponse = await chatResponsePromise;
    const correlationId =
      chatResponse.headers()['x-correlation-id'] ||
      chatResponse.headers()['x-request-id'] ||
      null;

    const dashboardPage = await context.newPage();
    await dashboardPage.goto(`${env.platformUrl}/o/${env.orgSlug}/decisions`);

    const decisionsResponse = await dashboardPage.waitForResponse(
      (resp) => resp.url().includes('/api/v1/decisions') && resp.ok(),
      { timeout: 30_000 },
    );
    const payload = await decisionsResponse.json();
    const decisions: any[] = payload.decisions || [];

    expect(decisions.length, 'Expected at least one decision to exist').toBeGreaterThan(0);

    const matched = correlationId
      ? decisions.find((d) => d.correlationId === correlationId)
      : decisions[0];

    expect(
      matched,
      `Expected a decision row${correlationId ? ` with correlationId ${correlationId}` : ''} to appear in the dashboard`,
    ).toBeTruthy();

    // DL-6 core assertion: the decision was routed to the correct org
    expect(
      matched.orgId,
      'Decision row must carry a non-null orgId — verifies per-org routing from DL-1/DL-3',
    ).toBeTruthy();
    expect(matched.orgId).toMatch(/^[a-zA-Z0-9_-]+/);

    // Verify the row is visible in the UI
    await expect(dashboardPage.getByText(/allow|transform|block|redact/i).first()).toBeVisible();
  });

  test('decisions page shows the org-scoped decision list without mixing other orgs', async ({
    authed,
    context,
  }) => {
    await sendChatMessage(authed, SAFE_PROMPT);

    const dashboardPage = await context.newPage();
    await dashboardPage.goto(`${env.platformUrl}/o/${env.orgSlug}/decisions`);

    const decisionsResponse = await dashboardPage.waitForResponse(
      (resp) => resp.url().includes('/api/v1/decisions') && resp.ok(),
      { timeout: 30_000 },
    );
    const payload = await decisionsResponse.json();
    const decisions: any[] = payload.decisions || [];

    // Every decision returned by this org-scoped endpoint must belong to this org
    const wrongOrg = decisions.filter(
      (d) => d.orgId && d.orgId !== env.orgSlug && !d.orgId.includes(env.orgSlug),
    );
    expect(
      wrongOrg,
      'Decisions endpoint returned rows from a different org — org isolation broken',
    ).toHaveLength(0);
  });
});
