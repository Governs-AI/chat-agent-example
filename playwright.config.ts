import { defineConfig, devices } from '@playwright/test';

// BASE_URL takes precedence for CI/CD environments; E2E_CHAT_URL is the legacy override.
// Falls back to the known staging deployment so tests can run without local services.
const CHAT_URL =
  process.env.BASE_URL ||
  process.env.E2E_CHAT_URL ||
  'http://localhost:3004';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: CHAT_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
