# E2E tests — governed chat flow (QA.4)

Playwright end-to-end tests for the `chat-agent-example` governed chat demo.
Covers the four flows required by **GOV-10 / TASKS.md §QA.4**:

| Flow | Spec |
|---|---|
| OIDC login via Keycloak | `auth.spec.ts` |
| PII prompt → decision log entry | `pii-decision-log.spec.ts` |
| Blocked message → UI indicator (badge + red styling) | `blocked-message.spec.ts` |
| Budget limit → UI message | `budget-limit.spec.ts` |

## Running locally

These tests drive the **real** local dev stack. Bring it up before running:

| Service | URL |
|---|---|
| Keycloak | http://localhost:8088 |
| Platform dashboard | http://localhost:3002 |
| Precheck | http://localhost:8082 |
| Chat app | http://localhost:3004 |

Install Playwright browsers once:

```bash
pnpm install
pnpm dlx playwright install chromium
```

Run the suite:

```bash
pnpm test:e2e
```

## Environment overrides

Tests read the following env vars (defaults in parentheses):

- `E2E_CHAT_URL` (`http://localhost:3004`)
- `E2E_PLATFORM_URL` (`http://localhost:3002`)
- `E2E_KEYCLOAK_URL` (`http://localhost:8088`)
- `E2E_KEYCLOAK_REALM` (`governs-ai`)
- `E2E_ORG_SLUG` (`local-dev-org`)
- `E2E_USERNAME` (`demo@governs.ai`)
- `E2E_PASSWORD` (`demo-password`)

Provide a test user seeded in the `governs-ai` Keycloak realm with
access to the `local-dev-org`.

## What each flow asserts

- **Auth** — middleware redirect, Keycloak handshake, authenticated landing, logout.
- **PII** — the `Redact` example prompt produces a redact decision badge in chat
  *and* a matching `transform`/`redact` entry in the platform decision log at
  `/o/<org>/decisions`.
- **Blocked** — the `Policy Violation` example prompt renders a `Block` badge,
  the red-bordered bubble, the stats tile increments, and the chat stays
  interactive so the user can retry.
- **Budget** — `/api/chat` is stubbed with an SSE stream carrying a
  budget-exceeded block so the test is deterministic without pre-exhausting
  real budget state. Asserts the budget reason is surfaced in the UI.

## Determinism

- No `waitForTimeout` — all waits are on `waitForURL` / `waitForResponse`
  / `toBeVisible`.
- Screenshots, traces, and video captured on failure
  (`screenshot: 'only-on-failure'`).
- Budget test uses route interception; all other specs rely on the deployed
  local stack and seeded Keycloak demo user.
