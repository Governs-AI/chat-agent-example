import { test, expect, loginViaKeycloak, env } from './fixtures';

test.describe('OIDC login via Keycloak', () => {
  test('unauthenticated user is redirected from / to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login(\?|$)/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with GovernsAI/i })).toBeEnabled();
  });

  test('user completes Keycloak login and lands on the governed chat', async ({ page }) => {
    await loginViaKeycloak(page);

    await expect(page).toHaveURL(new RegExp(`^${env.chatUrl}/?$`));
    await expect(page.getByRole('heading', { name: /GovernsAI Command Center Demo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible();

    const governanceCoverage = page.getByText(/Governance Coverage/i).locator('..');
    await expect(governanceCoverage.getByText(/%$/)).toBeVisible();
  });

  test('logout returns the user to the login screen', async ({ page }) => {
    await loginViaKeycloak(page);
    await Promise.all([
      page.waitForURL(/\/login(\?|$)/),
      page.getByRole('button', { name: /Logout/i }).click(),
    ]);
    await expect(page.getByRole('button', { name: /Continue with GovernsAI/i })).toBeVisible();
  });
});
