---
name: event-driven-orchestrator
description: Unified event routing for heartbeat, cron, manual, and webhook triggers. Routes events to registered handlers with dedup, throttle, and audit trail. Use when defining event-driven workflows, consolidating trigger logic, or debugging why a handler didn't fire.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added retry and retry-failed commands for error recovery"
---

# Event-Driven Orchestrator

Single dispatcher for all system events. Replaces ad-hoc trigger logic scattered across HEARTBEAT.md, cron scripts, and manual invocations.

## Core Concept

```
Trigger (heartbeat|cron|manual|webhook)
  → Dispatcher (classify + dedup + throttle)
    → Handler (skill script / shell command / sub-agent task)
      → Audit log
```

## Quick Reference

```bash
BASE="~/.openclaw/workspace/skills/event-driven-orchestrator/scripts"

# --- Dispatch an event ---
bash $BASE/dispatch.sh emit --event <name> --source <heartbeat|cron|manual|webhook> [--payload '{"key":"val"}']

# --- Handler management ---
bash $BASE/dispatch.sh list                          # List all registered handlers
bash $BASE/dispatch.sh register --event <name> --handler <command> [--throttle 300] [--dedup-key <key>]
bash $BASE/dispatch.sh unregister --id <handler-id>

# --- Audit ---
bash $BASE/dispatch.sh log [--event <name>] [--last 20]
bash $BASE/dispatch.sh stats [--days 7]

# --- Dry run ---
bash $BASE/dispatch.sh emit --event <name> --source manual --dry-run
```

## Architecture

```
event-driven-orchestrator/
├── SKILL.md
├── scripts/
│   └── dispatch.sh            # Unified dispatcher CLI
└── references/
    ├── handlers.json          # Registered event→handler mappings
    └── event-log.jsonl        # Append-only audit trail
```

## Event Schema

```json
{
  "id": "evt-20260226-001",
  "event": "research.daily.complete",
  "source": "cron",
  "timestamp": "2026-02-26T09:00:05Z",
  "payload": { "file": "research/daily-research-2026-02-26.md" },
  "handler": "research-tracker scan --days 1",
  "result": "ok",
  "durationMs": 1200
}
```

## Handler Registration

`references/handlers.json`:

```json
{
  "handlers": [
    {
      "id": "h-001",
      "event": "research.daily.complete",
      "handler": "bash ~/.openclaw/workspace/skills/research-tracker/scripts/tracker.sh scan --days 1",
      "throttleSec": 3600,
      "dedupKey": "research-scan",
      "enabled": true
    },
    {
      "id": "h-002",
      "event": "context.threshold.exceeded",
      "handler": "bash ~/.openclaw/workspace/skills/context-manager/scripts/context-ctl.sh compress",
      "throttleSec": 600,
      "dedupKey": "context-compress",
      "enabled": true
    },
    {
      "id": "h-003",
      "event": "skill.audit.scheduled",
      "handler": "bash ~/.openclaw/workspace/skills/skill-auditor/scripts/audit.sh full",
      "throttleSec": 86400,
      "dedupKey": "skill-audit",
      "enabled": true
    }
  ]
}
```

## Built-in Event Types

| Event | Source | Description |
|-------|--------|-------------|
| `heartbeat.tick` | heartbeat | Regular heartbeat poll received |
| `cron.job.complete` | cron | A cron job finished |
| `context.threshold.exceeded` | monitor | Token usage hit compression trigger |
| `research.daily.complete` | cron | Daily research pipeline finished |
| `skill.audit.scheduled` | cron/manual | Time for skill health check |
| `memory.maintenance` | heartbeat | Memory cleanup/distillation needed |
| `system.startup` | system | Gateway started |
| `manual.trigger` | manual | User-initiated event |

Custom events: any `namespace.action` string is valid.

## Throttle & Dedup

- **Throttle**: Minimum seconds between handler executions. Prevents storm scenarios.
- **Dedup**: Same `dedupKey` won't fire twice within throttle window, even from different event sources.

Example: `context-compress` with 600s throttle — if heartbeat AND cron both detect high tokens within 10 min, handler fires only once.

## Integration Points

### From HEARTBEAT.md

```bash
# Instead of inline logic, emit events:
bash dispatch.sh emit --event heartbeat.tick --source heartbeat
# Dispatcher routes to all handlers registered for heartbeat.tick
```

### From Cron Jobs

```bash
# At end of daily research cron:
bash dispatch.sh emit --event research.daily.complete --source cron --payload '{"file":"research/daily-research-2026-02-26.md"}'
```

### From Agent Code

```bash
# Manual trigger:
bash dispatch.sh emit --event manual.trigger --source manual --payload '{"task":"full-audit"}'
```

## Audit Trail

All events logged to `references/event-log.jsonl` (one JSON object per line, append-only).

```bash
# View last 10 events
bash dispatch.sh log --last 10

# Filter by event type
bash dispatch.sh log --event research.daily.complete

# Stats for the week
bash dispatch.sh stats --days 7
```

## Retry Logic

Failed handler executions can be retried:

```bash
# Retry a specific failed event (use event ID from log)
bash dispatch.sh retry --event evt-20260226-001

# Retry all failed events
bash dispatch.sh retry-failed

# Dry run (preview what would be retried)
bash dispatch.sh retry-failed --dry-run
```

- Max retries: 5 per event (configurable in script)
- Successful retries are logged with `retryOf` field
- Throttling still applies to retries

## Best Practices

1. **Name events with namespaces** — `domain.action` format (e.g., `research.daily.complete`)
2. **Set throttles conservatively** — start high, reduce if needed
3. **Use dry-run first** — verify handler resolution before live dispatch
4. **Review audit trail weekly** — catch silent failures
5. **One handler per concern** — don't overload a single handler with multiple responsibilities
