import { test, expect, sendChatMessage, env } from './fixtures';

const PII_PROMPT =
  'My name is John Doe, my SSN is 123-45-6789, and my email is john@example.com. Can you help me with my account?';

test.describe('PII message reaches the platform decision log', () => {
  test('sending a PII prompt produces a redact decision surfaced in the dashboard', async ({ authed, context }) => {
    const correlationHeader = authed.waitForResponse(
      (resp) => resp.url().endsWith('/api/chat') && resp.status() === 200,
    );

    await sendChatMessage(authed, PII_PROMPT);

    const chatResponse = await correlationHeader;
    const correlationId =
      chatResponse.headers()['x-correlation-id'] ||
      chatResponse.headers()['x-request-id'] ||
      null;

    const redactBadge = authed.getByText(/^Redact$/i).first();
    await expect(redactBadge).toBeVisible({ timeout: 20_000 });

    const redactedTile = authed.getByText(/^Redacted$/).locator('..');
    await expect(redactedTile).toContainText(/[1-9]\d*/);

    const dashboardPage = await context.newPage();
    await dashboardPage.goto(`${env.platformUrl}/o/${env.orgSlug}/decisions`);

    const decisionsResponse = await dashboardPage.waitForResponse(
      (resp) => resp.url().includes('/api/v1/decisions') && resp.ok(),
      { timeout: 30_000 },
    );
    const payload = await decisionsResponse.json();
    const decisions: any[] = payload.decisions || [];

    const matched = decisions.find((d) => {
      const hasCorr = correlationId ? d.correlationId === correlationId : true;
      const isTransformOrRedact = d.decision === 'transform' || d.decision === 'redact';
      return hasCorr && (isTransformOrRedact || (d.tags || []).some((t: string) => /pii/i.test(t)));
    });

    expect(matched, 'Expected a redact/transform decision to appear in the dashboard decision log').toBeTruthy();

    await expect(
      dashboardPage.getByText(/transform|redact/i).first(),
    ).toBeVisible();
  });
});
