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

    // Without a correlation id we cannot prove the dashboard row belongs to *this*
    // prompt — a stale redact row from a prior run would silently satisfy the match
    // predicate. Fail loudly so the test can't pass on ambient data.
    expect(
      correlationId,
      '/api/chat response must carry x-correlation-id (or x-request-id)',
    ).toBeTruthy();

    const redactBadge = authed.getByText(/^Redact$/i).first();
    await expect(redactBadge).toBeVisible({ timeout: 20_000 });

    const redactedTile = authed.getByText(/^Redacted$/).locator('..');
    await expect(redactedTile).toContainText(/[1-9]\d*/);

    const dashboardPage = await context.newPage();
    await dashboardPage.goto(`${env.platformUrl}/o/${env.orgSlug}/decisions`);

    // Poll the decisions endpoint so the test tolerates ingestion lag: /api/chat
    // returning does not guarantee the decision is already in the read model.
    await expect
      .poll(
        async () => {
          const resp = await dashboardPage.request.get(
            `${env.platformUrl}/api/v1/decisions?orgSlug=${encodeURIComponent(env.orgSlug)}`,
          );
          if (!resp.ok()) return false;
          const payload = await resp.json();
          const decisions: any[] = payload.decisions ?? [];
          return decisions.some((d) => {
            if (d.correlationId !== correlationId) return false;
            const isTransformOrRedact =
              d.decision === 'transform' || d.decision === 'redact';
            const hasPiiTag = (d.tags ?? []).some((t: string) => /pii/i.test(t));
            return isTransformOrRedact || hasPiiTag;
          });
        },
        {
          message: `Expected a redact/transform decision with correlationId=${correlationId} to appear in the platform decision log`,
          timeout: 30_000,
          intervals: [1_000, 2_000, 4_000, 8_000],
        },
      )
      .toBe(true);

    // Scope to a decisions-table row so we don't match legend / filter labels.
    const decisionRow = dashboardPage
      .getByRole('row')
      .filter({ hasText: /transform|redact/i })
      .first();
    await expect(decisionRow).toBeVisible();
  });
});
