---
name: memory-hygiene
description: Audit, clean, and optimize Clawdbot's vector memory (LanceDB). Use when memory is bloated with junk, token usage is high from irrelevant auto-recalls, or setting up memory maintenance automation.
version: 1.1.0
homepage: https://github.com/xdylanbaker/memory-hygiene
metadata:
  changes:
    - "1.1.0: Added backup/restore, multi-vector-store support (LanceDB, SQLite)"
---

# Memory Hygiene

Keep vector memory lean. Prevent token waste from junk memories.

## Supported Vector Stores

| Store | Path | Notes |
|-------|------|-------|
| LanceDB | `~/.clawdbot/memory/lancedb/` | Default |
| SQLite | `~/.clawdbot/memory/sqlite/` | Optional |

To switch stores, configure in `openclaw.json`:
```json
{
  "plugins": {
    "entries": {
      "memory-lancedb": {
        "config": {
          "dbPath": "~/.clawdbot/memory/lancedb/"
        }
      }
    }
  }
}
```

## Quick Commands

**Audit:** Check what's in memory
```
memory_recall query="*" limit=50
```

**Backup:** Export LanceDB to JSON
```bash
# Backup to timestamped file
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/.openclaw/workspace/memory/backups
lancedb export --path ~/.clawdbot/memory/lancedb --output ~/.openclaw/workspace/memory/backups/lancedb-$TIMESTAMP.jsonl
```

**Restore:** Import from backup
```bash
# Restore from backup file
lancedb import --path ~/.clawdbot/memory/lancedb --input ~/.openclaw/workspace/memory/backups/lancedb-20260314-120000.jsonl
```

**Wipe:** Clear all vector memory
```bash
rm -rf ~/.clawdbot/memory/lancedb/
```
Then restart gateway: `clawdbot gateway restart`

**Reseed:** After wipe, store key facts from MEMORY.md
```
memory_store text="<fact>" category="preference|fact|decision" importance=0.9
```

## Config: Disable Auto-Capture

The main source of junk is `autoCapture: true`. Disable it:

```json
{
  "plugins": {
    "entries": {
      "memory-lancedb": {
        "config": {
          "autoCapture": false,
          "autoRecall": true
        }
      }
    }
  }
}
```

Use `gateway action=config.patch` to apply.

## Blacklist Filter (Auto-Capture)

To prevent junk from being stored, add a blacklist to filter out noise:

```json
{
  "plugins": {
    "entries": {
      "memory-lancedb": {
        "config": {
          "autoCapture": true,
          "autoCaptureBlacklist": [
            "HEARTBEAT_OK",
            "heartbeat",
            "No new messages",
            "Session completed",
            "ping",
            "pong"
          ]
        }
      }
    }
  }
}
```

The blacklist filters out common noise patterns before storage. Add entries based on your cron output patterns.

## Backup & Restore

### Manual Backup
```bash
# Create backup directory
mkdir -p ~/.openclaw/workspace/memory/backups

# Export LanceDB to JSONL
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
lancedb export --path ~/.clawdbot/memory/lancedb --output ~/.openclaw/workspace/memory/backups/lancedb-$TIMESTAMP.jsonl

# Also backup the schema
cp ~/.clawdbot/memory/lancedb/*.schema ~/.openclaw/workspace/memory/backups/ 2>/dev/null || true

echo "Backup saved: lancedb-$TIMESTAMP.jsonl"
```

### Manual Restore
```bash
# List available backups
ls -la ~/.openclaw/workspace/memory/backups/

# Restore from backup
lancedb import --path ~/.clawdbot/memory/lancedb --input ~/.openclaw/workspace/memory/backups/lancedb-20260314-120000.jsonl

# Restart gateway
openclaw gateway restart
```

### Cron Backup (Weekly)
```bash
# Add weekly backup cron
openclaw cron add --name "memory-backup" --schedule "0 3 * * 0" --task "Backup LanceDB to memory/backups/" --model minimax-m2.1
```

## What to Store (Intentionally)

✅ Store:
- User preferences (tools, workflows, communication style)
- Key decisions (project choices, architecture)
- Important facts (accounts, credentials locations, contacts)
- Lessons learned

❌ Never store:
- Heartbeat status ("HEARTBEAT_OK", "No new messages")
- Transient info (current time, temp states)
- Raw message logs (already in files)
- OAuth URLs or tokens

## Monthly Maintenance Cron

Set up a monthly wipe + reseed:

```
cron action=add job={
  "name": "memory-maintenance",
  "schedule": "0 4 1 * *",
  "text": "Monthly memory maintenance: 1) Wipe ~/.clawdbot/memory/lancedb/ 2) Parse MEMORY.md 3) Store key facts to fresh LanceDB 4) Report completion"
}
```

## Storage Guidelines

When using memory_store:
- Keep text concise (<100 words)
- Use appropriate category
- Set importance 0.7-1.0 for valuable info
- One concept per memory entry
