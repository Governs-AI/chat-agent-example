# Advanced Governance Simulator

This advanced example is built for product demos, sales engineering, and customer pilots.

It runs a scenario pack against the GovernsAI precheck API and prints:
- decision per scenario (`allow`, `redact`, `confirm`, `block`)
- latency per call
- reason snippets
- distribution summary

## Why this helps promotion

Use this to demonstrate that GovernsAI is not just a chat UI add-on:
- policy control is enforced before execution
- PII handling is automatic
- high-risk actions are step-up gated
- malicious requests are blocked
- controls are measurable and repeatable

## Run

```bash
cd chat-agent-example
node examples/advanced-governance-simulator/run-demo.mjs
```

## Environment

Set these before running (or rely on defaults for local demo):

```bash
export PRECHECK_BASE_URL=http://localhost:8080
export PRECHECK_API_KEY=demo_precheck_key
export GOVERNED_USER_ID=demo-enterprise-user
```

## Expected output shape

The script prints a table with scenario name, decision, HTTP status, latency, and reasons.
This gives you a concrete artifact to share in demos and technical evaluations.
