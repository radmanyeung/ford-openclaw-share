---
name: research-tracker
description: Track daily research findings adoption, hypothesis verification, and decision outcomes. Reads research/daily-research-*.md files and generates adoption rate reports.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added export/import commands for backup and cross-workspace sync"
---

# Research Tracker

Track the lifecycle of research findings — from discovery through adoption/rejection — with hypothesis verification and decision outcome logging.

## When to Use

- Reviewing what research findings were actually adopted
- Checking hypothesis verification status
- Generating adoption rate reports
- Logging decisions on specific findings

## Quick Reference

```bash
BASE="~/.openclaw/workspace/skills/research-tracker/scripts"

# Scan all research files and show findings
bash $BASE/tracker.sh scan

# Show adoption status summary
bash $BASE/tracker.sh status

# Mark a finding as adopted/rejected/pending
bash $BASE/tracker.sh mark --finding "finding text or ID" --status adopted --reason "Worked well in production"

# Track a hypothesis
bash $BASE/tracker.sh hypothesis --text "Context compression saves >50% tokens" --status verified

# Generate adoption rate report
bash $BASE/tracker.sh report [--days 30]

# JSON output
bash $BASE/tracker.sh report --json
```

## Architecture

```
research-tracker/
├── SKILL.md
├── scripts/
│   └── tracker.sh             # Main CLI
└── references/
    └── tracking-db.json       # Findings + decisions log
```

## Commands

### scan

Parse all `research/daily-research-*.md` files and extract findings.

```bash
bash tracker.sh scan [--days 7]
```

Extracts:
- Section headers as topic areas
- Bullet points as individual findings
- Dates from filenames

### status

Show current status of all tracked findings.

```bash
bash tracker.sh status
```

Output:
```
=== Research Findings Status ===
📊 Total: 42 | ✅ Adopted: 15 | ❌ Rejected: 8 | ⏳ Pending: 19

Recent:
  [2026-02-25] "OpenClaw skill consolidation" — ✅ adopted
  [2026-02-24] "Token compression trigger at 70%" — ✅ adopted
  [2026-02-23] "Use Tavily for deep research" — ⏳ pending
```

### mark

Update the status of a specific finding.

```bash
bash tracker.sh mark --finding "skill consolidation" --status adopted --reason "Merged 3 context skills"
```

**Statuses:** `adopted` | `rejected` | `pending` | `deferred`

### hypothesis

Track a hypothesis and its verification outcome.

```bash
# Add hypothesis
bash tracker.sh hypothesis --text "Cron backfill is needed after crash" --status unverified

# Update verification
bash tracker.sh hypothesis --text "Cron backfill is needed after crash" --status verified --evidence "Confirmed: idle jobs after crash loop"
```

**Statuses:** `unverified` | `verified` | `falsified` | `inconclusive`

### report

Generate an adoption rate report.

```bash
bash tracker.sh report [--days 30] [--json]
```

Report includes:
- Adoption rate (adopted / total)
- Rejection rate
- Average time from finding to decision
- Top adopted topics
- Findings still pending review

### export

Export tracking DB to a backup file for backup or cross-workspace sync.

```bash
# Default filename with timestamp
bash tracker.sh export

# Custom filename
bash tracker.sh export "research-backup-2026-03-14.json"
```

### import

Import tracking DB from a backup file. Creates automatic backup of current DB.

```bash
bash tracker.sh import "research-backup-2026-03-14.json"
```

### prune

Remove old entries to keep DB manageable.

```bash
# Remove entries older than 90 days (default)
bash tracker.sh prune

# Custom retention period
bash tracker.sh prune --older-than 30
```

## Data Storage

Findings and decisions stored in `references/tracking-db.json`:

```json
{
  "findings": [
    {
      "id": "f-20260225-001",
      "date": "2026-02-25",
      "source": "daily-research-2026-02-25.md",
      "text": "OpenClaw skill consolidation reduces overlap",
      "topic": "OpenClaw Skill Updates",
      "status": "adopted",
      "reason": "Merged 3 context skills into context-manager",
      "decidedAt": "2026-02-26T01:30:00Z"
    }
  ],
  "hypotheses": [
    {
      "id": "h-001",
      "text": "Context compression saves >50% tokens",
      "status": "verified",
      "evidence": "Observed 60-80% compression ratio in logs",
      "createdAt": "2026-02-20T10:00:00Z",
      "verifiedAt": "2026-02-25T15:00:00Z"
    }
  ]
}
```

## Integration

### With Daily Research Pipeline

After `daily-intelligence-aggregator` or `Daily Research & Evolution` cron runs, use:

```bash
bash tracker.sh scan --days 1
```

### With Heartbeat

```markdown
## Research Review (weekly)
- Run: bash ~/.openclaw/workspace/skills/research-tracker/scripts/tracker.sh status
- Flag findings pending > 7 days for review
```

### With Memory

Adopted findings can feed into `MEMORY.md` updates during heartbeat memory maintenance cycles.

## Best Practices

1. **Scan daily** — keep tracking-db.json current
2. **Decide within 7 days** — don't let findings go stale
3. **Record reasons** — helps future pattern recognition
4. **Review monthly** — adoption rate trends reveal research quality
5. **Archive old findings** — prune entries older than 90 days from active tracking
