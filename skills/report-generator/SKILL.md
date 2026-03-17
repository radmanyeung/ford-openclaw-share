---
name: report-generator
description: Generate daily/weekly reports from memory, git logs, and context summaries. Use when user requests: daily reports, weekly summaries, context history reports, project status digests, or any task requiring structured summarization of accumulated data.
version: 1.0.0
---

# Report Generator

## Quick Start

```bash
./scripts/generate-report.sh --type daily --output reports/
./scripts/generate-report.sh --type weekly --memory memory/context-summary.md
```

## Scripts

- `scripts/generate-report.sh` - Main report generation CLI
- `scripts/generate-report.js` - Node.js implementation for complex reports

## References

- `references/templates.md` - Report templates and formats

## Usage Patterns

| Trigger | Action |
|---------|--------|
| "daily report" | Generate daily summary from memory/ |
| "weekly summary" | Generate weekly digest with git log |
| "context report" | Extract and format context-summary.md |
| "project status" | Combine git status + memory + tasks |

## Token Optimization

- Use `--compact` for summary-only output
- Limit context lines: `--max-lines 500`
- Exclude debug logs: `--skip-logs`
