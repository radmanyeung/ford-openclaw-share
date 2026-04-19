#!/bin/bash
# osint skill runner — thin wrapper that invokes the osint-triage workflow
# via workflow-orchestrator. See ../SKILL.md for the hard rule against
# hallucinated reports.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <subject> [scopeNotes] [telegramTarget]" >&2
  exit 2
fi

SUBJECT="$1"
SCOPE="${2:-}"
TG_TARGET="${3:-}"

export PATH="$HOME/.local/bin:$PATH"

ORCH="$HOME/.openclaw/workspace/skills/workflow-orchestrator/scripts/orchestrator.mjs"
if [ ! -f "$ORCH" ]; then
  echo "orchestrator.mjs not found at $ORCH" >&2
  exit 3
fi

exec node "$ORCH" \
  --action execute \
  --workflow osint-triage \
  --verbose \
  --input subject="$SUBJECT" \
  --input scopeNotes="$SCOPE" \
  --input telegramTarget="$TG_TARGET"
