---
name: provider-health-check
description: Test all model providers configured in OpenClaw and report which providers/models are reachable and responding. Use when you need a fast provider connectivity/credential health check, after changing openclaw.json model providers, or when model calls start failing.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added detailed OAuth info (expiry date, user email), --oauth-details flag"
---

# Provider Health Check

Run a deterministic provider smoke test against every configured provider in OpenClaw.

v4 adapters/features included:
- OpenAI-compatible (`/chat/completions` + fallback `/completions`)
- Google Gemini (`/models/{model}:generateContent`)
- Jina embeddings (`/embeddings`)
- OAuth-managed providers are INCLUDED by reading token from `~/.openclaw/agents/main/agent/auth-profiles.json`
- OAuth state classification (`present` / `expired` / `missing-token`) for fast diagnosis
- Re-login assistance hints for OAuth failures (`openclaw models auth login --provider <name>`)

## Quick Start

```bash
node skills/provider-health-check/scripts/test-providers.mjs
```

Optional:

```bash
# Use a specific config file
node skills/provider-health-check/scripts/test-providers.mjs --config ~/.openclaw/openclaw.json

# Increase timeout to 20s
node skills/provider-health-check/scripts/test-providers.mjs --timeout 20000

# JSON output (for automation)
node skills/provider-health-check/scripts/test-providers.mjs --json

# Include OAuth re-login suggestions in text output
node skills/provider-health-check/scripts/test-providers.mjs --assist-login

# Show detailed OAuth info (email, expiry date)
node skills/provider-health-check/scripts/test-providers.mjs --oauth-details
```

## Workflow

1. Read provider definitions from OpenClaw config.
2. Pick first configured model for each provider.
3. Send minimal test request (`ping`) to OpenAI-compatible endpoints:
   - `POST {baseUrl}/chat/completions`
   - fallback `POST {baseUrl}/completions`
4. Print pass/fail summary without leaking API keys.
5. Return non-zero exit code if any provider fails.

## Output Interpretation

- `OK` = endpoint reachable + auth accepted + model responded.
- `FAIL (401/403)` = invalid/expired credentials or wrong auth mode.
- `FAIL (404)` = incorrect base URL or endpoint path.
- `FAIL timeout` = network issue, blocked egress, or provider latency.
- `FAIL missing baseUrl/model` = incomplete provider config.

## Output Example

```
Config: /home/ubuntu/.openclaw/openclaw.json
Auth profiles: /home/ubuntu/.openclaw/agents/main/agent/auth-profiles.json
FAIL qwen-portal  model=coder-model  (401/404) oauth=expired  empty response
     ↳ Re-login: openclaw models auth login --provider qwen-portal
OK   nvidia-integrate  model=minimaxai/minimax-m2.1  via /chat/completions

=== OAuth Details ===

qwen-portal:
  Email: N/A
  Expires: 2026-03-11T08:15:37.493Z
  State: expired
```

## Notes

- Never print secrets.
- Use this as a smoke test, not a quality benchmark.
- If provider needs custom auth/query params, update provider config to OpenAI-compatible gateway format first.
