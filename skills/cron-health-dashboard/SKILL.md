---
name: cron-health-dashboard
description: Unified monitoring dashboard for all OpenClaw cron jobs. Reads job list, checks recent execution status, generates health reports (ok/failed/idle/overdue), and supports alert thresholds.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added history, trend, archive commands for historical tracking"
---

# Cron Health Dashboard

Monitor all OpenClaw cron jobs from a single view. Detects failures, idle jobs, overdue executions, and generates structured health reports.

## When to Use

- Checking overall cron health after a crash/restart
- Periodic health monitoring (e.g., hourly heartbeat check)
- Identifying stale/idle jobs that haven't run
- Generating status reports for review

## Quick Reference

```bash
BASE="~/.openclaw/workspace/skills/cron-health-dashboard/scripts"

# Full health report (all jobs)
bash $BASE/cron-health.sh report

# Quick status summary (one-liner per job)
bash $BASE/cron-health.sh summary

# Check for problems only (non-ok jobs)
bash $BASE/cron-health.sh problems

# Check specific job by name or ID
bash $BASE/cron-health.sh check "Cron Health Check"

# JSON output (for automation)
bash $BASE/cron-health.sh report --json
```

## Architecture

```
cron-health-dashboard/
├── SKILL.md
├── scripts/
│   └── cron-health.sh       # Main CLI
└── references/
    └── alert-thresholds.json # Configurable alert rules
```

## Commands

### report

Full health report for all cron jobs.

```bash
bash cron-health.sh report [--json]
```

For each job, reports:
- **Name** and schedule
- **Status**: ok / failed / idle / overdue
- **Last run**: timestamp or "never"
- **Next run**: upcoming schedule
- **Alert**: ⚠️ if threshold breached

### summary

Compact one-line-per-job overview.

```bash
bash cron-health.sh summary
```

### problems

Show only jobs with non-ok status (failed, idle, overdue).

```bash
bash cron-health.sh problems
```

### check

Check a single job by name (partial match) or ID.

```bash
bash cron-health.sh check "Daily Encrypted Backup"
bash cron-health.sh check a8041ed5
```

### archive

Save current report to history for trend analysis.

```bash
bash cron-health.sh archive
# Output: ✅ Archived to: references/history/20260314-113000.json
```

### history

View historical reports.

```bash
# Last 7 days
bash cron-health.sh history

# Last 30 days
bash cron-health.sh history 30
```

### trend

Show success rate trend over time.

```bash
# Last 7 days
bash cron-health.sh trend

# Last 30 days
bash cron-health.sh trend 30
```

Example output:
```
=== Cron Success Rate Trend (last 7 days) ===
20260310 | #######               | 35%
20260311 | ##########            | 55%
20260312 | ############          | 60%
20260313 | ###############       | 70%
```

## Alert Thresholds

Configure in `references/alert-thresholds.json`:

```json
{
  "idleWarningHours": 48,
  "overdueMultiplier": 2.0,
  "failureAlertCount": 2,
  "ignoredJobs": []
}
```

| Field | Description |
|-------|-------------|
| `idleWarningHours` | Flag as ⚠️ IDLE if job has never run and was created >N hours ago |
| `overdueMultiplier` | Flag as ⚠️ OVERDUE if last run > interval × multiplier |
| `failureAlertCount` | Alert after N consecutive failures |
| `ignoredJobs` | Job names/IDs to exclude from reports |

## Integration

### Heartbeat

```markdown
## Cron Health (hourly)
- Run: bash ~/.openclaw/workspace/skills/cron-health-dashboard/scripts/cron-health.sh problems
- If any problems found, report to user
```

### Post-Crash Recovery

After an OpenClaw crash loop, cron jobs that missed their window stay "idle". Run:

```bash
bash cron-health.sh problems
# Then manually trigger idle jobs:
# openclaw cron run <job-id>
```

## Output Example

```
=== Cron Health Report (2026-02-26 01:30 HKT) ===

✅ Cron Health Check          | hourly    | last: 34m ago | next: in 26m
✅ memory-janitor-daily       | daily 02:05 | last: 24h ago | next: in 30m
✅ Daily Encrypted Backup     | daily 02:30 | last: 23h ago | next: in 55m
✅ TSLS Auto-Observation      | every 3h  | last: 2h ago  | next: in 1h
⚠️ TSLS Apply Learning        | weekly Mon 04:30 | last: NEVER | status: idle
⚠️ Weekly Knowledge Synthesis  | weekly Mon 05:00 | last: NEVER | status: idle

Problems: 2 jobs need attention
```
