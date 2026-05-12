import { test as base, expect, type Page } from '@playwright/test';

export const env = {
  // Chat app: BASE_URL → E2E_CHAT_URL → local fallback
  chatUrl:
    process.env.BASE_URL ||
    process.env.E2E_CHAT_URL ||
    'http://localhost:3004',

  // Platform dashboard (decisions page)
  platformUrl:
    process.env.E2E_PLATFORM_URL ||
    'https://platform-platform-pi.vercel.app',

  // Keycloak OIDC provider
  keycloakUrl:
    process.env.E2E_KEYCLOAK_URL ||
    'https://governs-keycloak.onrender.com',

  keycloakRealm: process.env.E2E_KEYCLOAK_REALM || 'governs-ai',

  // Test credentials — must be provided via env vars for real runs
  username: process.env.KEYCLOAK_USER || process.env.E2E_USERNAME || '',
  password: process.env.KEYCLOAK_PASSWORD || process.env.E2E_PASSWORD || '',

  orgSlug: process.env.E2E_ORG_SLUG || 'local-dev-org',
};

export async function loginViaKeycloak(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Continue with GovernsAI/i })).toBeVisible();
  await page.getByRole('button', { name: /Continue with GovernsAI/i }).click();

  await page.waitForURL(new RegExp(`^${env.keycloakUrl}/realms/${env.keycloakRealm}/.+`));

  await page.getByLabel(/Username or email/i).fill(env.username);
  await page.getByLabel(/Password/i).fill(env.password);
  await Promise.all([
    page.waitForURL(`${env.chatUrl}/**`),
    page.getByRole('button', { name: /Sign In/i }).click(),
  ]);

  await expect(page.getByRole('heading', { name: /GovernsAI Command Center Demo/i })).toBeVisible();
}

export async function sendChatMessage(page: Page, prompt: string): Promise<void> {
  const textarea = page.getByPlaceholder('Type your message...');
  await textarea.fill(prompt);
  await page.getByRole('button', { name: /^Send$/ }).click();
}

export async function useExamplePrompt(page: Page, label: RegExp | string): Promise<void> {
  const card = page.getByText(typeof label === 'string' ? new RegExp(label, 'i') : label, { exact: false }).first().locator('..');
  await card.getByRole('button', { name: /Use Prompt/i }).click();
  await page.getByRole('button', { name: /^Send$/ }).click();
}

export const test = base.extend<{ authed: Page }>({
  authed: async ({ page }, use) => {
    await loginViaKeycloak(page);
    await use(page);
  },
});

export { expect };
