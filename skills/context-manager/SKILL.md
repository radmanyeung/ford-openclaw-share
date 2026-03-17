---
name: context-manager
description: Unified context lifecycle management — token optimization, automatic compression, structured summarization, and cross-session archival. Replaces context-aware-memory, context-compression-manager, and context-memory-archivist.
version: 1.1.0
metadata:
  replaces:
    - context-aware-memory
    - context-compression-manager
    - context-memory-archivist
  changes:
    - "1.1.0: Added monitor, heartbeat commands for HEARTBEAT.md integration + model-aware token calculation"
---

# Context Manager

Single entry point for the full context lifecycle: **monitor → compress → archive → retrieve**.

## When to Use

- Session approaching token limits
- Need to compress/summarize long sessions
- Archiving session context for cross-session retrieval
- Searching past archived memories by topic
- Tracking file artifacts and decisions across sessions

## Quick Reference

```bash
BASE="~/.openclaw/workspace/skills/context-manager/scripts"

# --- Monitor & Status ---
bash $BASE/context-ctl.sh status          # Token usage, thresholds, summary age
bash $BASE/context-ctl.sh stats           # Compression history & metrics
bash $BASE/context-ctl.sh monitor         # Check token usage (supports --auto-compress)
bash $BASE/context-ctl.sh heartbeat       # For HEARTBEAT.md - auto-compress if needed

# --- Compression ---
bash $BASE/context-ctl.sh compress                # Compress if threshold exceeded
bash $BASE/context-ctl.sh compress --force        # Force immediate compression
bash $BASE/context-ctl.sh compress --dry-run      # Preview without changes

# --- Artifact Tracking ---
bash $BASE/context-ctl.sh track --files "src/a.ts,src/b.ts"
bash $BASE/context-ctl.sh decide --text "Use Redis for caching"
bash $BASE/context-ctl.sh next --text "Implement auth module"

# --- Archival ---
bash $BASE/context-ctl.sh archive --session-id SESSION_ID [--tags "tag1,tag2"] [--importance high]
bash $BASE/context-ctl.sh search "API design decisions" [--limit 5] [--threshold 0.7]
bash $BASE/context-ctl.sh list [--older-than 30d]
bash $BASE/context-ctl.sh retrieve --id ARCHIVE_ID
bash $BASE/context-ctl.sh consolidate --topic "skill development" [--dry-run]
bash $BASE/context-ctl.sh prune --older-than 180d
```

## Architecture

```
context-manager/
├── SKILL.md
├── scripts/
│   └── context-ctl.sh        # Unified CLI (all commands)
├── references/
│   ├── thresholds.json        # Token threshold config
│   ├── compression-log.json   # Compression event history
│   └── summary-template.md   # Default summary structure
```

## Core Modules

### 1. Token Monitor

Tracks session token usage against dynamic thresholds.

| Period | Trigger | Max Context | Reserve |
|--------|---------|-------------|---------|
| Working (09-18) | 70% of max | 200k (capped) | 20% |
| Idle (18-09) | 70% of max | 200k (capped) | 20% |

Model-aware: if model supports >200k, cap at 200k. Otherwise use model max.

### 2. Compression Engine

Sliding-window compression with structured summary preservation.

**What's preserved on compression:**
- Session Intent — current task goal
- Files Modified — paths + change descriptions
- Decisions Made — architectural/design choices with rationale
- Next Steps — planned actions with status
- Key Values — important constants, paths, configs

**Output:** Written to `memory/context-summary.md` using anchored iterative summarization.

### 3. Artifact Tracker

Maintains a live inventory of session artifacts:

```bash
# Track file modifications
bash context-ctl.sh track --files "auth.ts,config/db.ts"

# Record a decision (preserves "why")
bash context-ctl.sh decide --text "Using Redis for session storage — lower latency than Postgres"

# Add next step
bash context-ctl.sh next --text "Fix test failures in auth module"
```

### 4. Cross-Session Archive

Archive sessions for later semantic retrieval.

**Importance → Retention:**

| Level | Retention |
|-------|-----------|
| critical | Forever |
| high | 180 days |
| medium | 90 days |
| low | 30 days |

**Consolidation:** Merge fragmented memories on the same topic:

```bash
bash context-ctl.sh consolidate --topic "memory management" --dry-run
```

## Integration

### HEARTBEAT.md

Add to heartbeat checklist:

```markdown
## Context Management
- Run: bash ~/.openclaw/workspace/skills/context-manager/scripts/context-ctl.sh heartbeat
```

The `heartbeat` command automatically:
1. Checks current session context tokens
2. Applies model-aware threshold (uses min of config vs model limit)
3. Auto-compresses if threshold exceeded

For manual checks:
```bash
bash context-ctl.sh status          # Check state
bash context-ctl.sh monitor         # Check with auto-compress option
bash context-ctl.sh search "topic"  # Retrieve prior context
```

### Session Start

```bash
bash context-ctl.sh status          # Check state
bash context-ctl.sh search "topic"  # Retrieve prior context
```

### Session End

```bash
bash context-ctl.sh archive --session-id $SID --auto-tag
```

## Configuration

Edit `references/thresholds.json`:

```json
{
  "workingHours": { "start": "09:00", "end": "18:00", "triggerPct": 70, "maxContext": 200000 },
  "idleHours": { "start": "18:00", "end": "09:00", "triggerPct": 70, "maxContext": 200000 },
  "reservePct": 20,
  "archive": {
    "defaultImportance": "medium",
    "retentionDays": { "critical": -1, "high": 180, "medium": 90, "low": 30 },
    "similarityThreshold": 0.7
  }
}
```

## Best Practices

1. **Optimize for tokens-per-task**, not tokens-per-request
2. **Compress at 70-80%** — don't wait for overflow
3. **Always --dry-run** before first real compression
4. **Tag archives generously** — improves retrieval accuracy
5. **Consolidate weekly** — prevents memory fragmentation
6. **Record decisions with rationale** — "why" matters more than "what"
