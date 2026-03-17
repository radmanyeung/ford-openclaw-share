#!/usr/bin/env bash
# context-ctl.sh — Unified context lifecycle CLI
# Usage: bash context-ctl.sh <command> [options]
#
# Commands:
#   status              Show token usage, thresholds, summary age
#   stats               Show compression history & metrics
#   monitor [--auto-compress]  Check token usage, optionally auto-compress if threshold exceeded
#   compress [--force] [--dry-run]   Trigger compression
#   track --files "a,b"              Track modified files
#   decide --text "..."              Record a decision
#   next --text "..."                Add a next step
#   archive --session-id ID [--tags "t1,t2"] [--importance high]
#   search "query" [--limit N] [--threshold F]
#   list [--older-than Nd]
#   retrieve --id ARCHIVE_ID
#   consolidate --topic "..." [--dry-run]
#   prune --older-than Nd
#   heartbeat                  Run from HEARTBEAT.md - checks and auto-compresses if needed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
REFS_DIR="$BASE_DIR/references"
WORKSPACE="${HOME}/.openclaw/workspace"
SUMMARY_FILE="$WORKSPACE/memory/context-summary.md"
THRESHOLDS_FILE="$REFS_DIR/thresholds.json"
COMPRESSION_LOG="$REFS_DIR/compression-log.json"
ARCHIVE_DIR="$REFS_DIR/archives"

mkdir -p "$REFS_DIR" "$ARCHIVE_DIR" "$(dirname "$SUMMARY_FILE")"

# Init files if missing
[[ -f "$COMPRESSION_LOG" ]] || echo '[]' > "$COMPRESSION_LOG"
[[ -f "$THRESHOLDS_FILE" ]] || cat > "$THRESHOLDS_FILE" <<'EOF'
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
EOF

CMD="${1:-help}"
shift || true

case "$CMD" in
  status)
    echo "=== Context Manager Status ==="
    HOUR=$(date +%H)
    if (( HOUR >= 9 && HOUR < 18 )); then
      PERIOD="Working Hours"
    else
      PERIOD="Idle Hours"
    fi
    echo "Period: $PERIOD"
    echo "Thresholds: $(cat "$THRESHOLDS_FILE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
p = 'workingHours' if $HOUR >= 9 and $HOUR < 18 else 'idleHours'
mx = d[p]['maxContext']
tr = int(mx * d[p]['triggerPct'] / 100)
rv = int(mx * d['reservePct'] / 100)
print(f'Max={mx:,} | Trigger={tr:,} | Reserve={rv:,}')
" 2>/dev/null || echo "see thresholds.json")"
    if [[ -f "$SUMMARY_FILE" ]]; then
      AGE=$(( ($(date +%s) - $(stat -c %Y "$SUMMARY_FILE" 2>/dev/null || stat -f %m "$SUMMARY_FILE" 2>/dev/null || echo 0)) / 3600 ))
      echo "Summary: $SUMMARY_FILE (${AGE}h old)"
    else
      echo "Summary: not yet created"
    fi
    COMP_COUNT=$(python3 -c "import json; print(len(json.load(open('$COMPRESSION_LOG'))))" 2>/dev/null || echo 0)
    echo "Total compressions: $COMP_COUNT"
    ;;

  stats)
    echo "=== Compression Statistics ==="
    python3 -c "
import json, sys
from datetime import datetime, timedelta
log = json.load(open('$COMPRESSION_LOG'))
if not log:
    print('No compression events recorded yet.')
    sys.exit(0)
now = datetime.utcnow()
today = [e for e in log if e.get('timestamp','')[:10] == now.strftime('%Y-%m-%d')]
week = [e for e in log if datetime.fromisoformat(e.get('timestamp','2000-01-01T00:00:00')) > now - timedelta(days=7)]
print(f'Total: {len(log)} | Today: {len(today)} | This week: {len(week)}')
if log:
    ratios = [float(e.get('compressionRatio','0').replace('%','')) for e in log if 'compressionRatio' in e]
    if ratios:
        print(f'Avg compression ratio: {sum(ratios)/len(ratios):.1f}%')
    print(f'Last compression: {log[-1].get(\"timestamp\",\"unknown\")}')
" 2>/dev/null || echo "No stats available"
    ;;

  monitor)
    AUTO_COMPRESS=false
    while [[ $# -gt 0 ]]; do
      case "$1" in --auto-compress) AUTO_COMPRESS=true; shift ;; *) shift ;; esac
    done
    
    echo "=== Context Monitor ==="
    
    # Get current context from session status (if available)
    CONTEXT_TOKENS=0
    if command -v openclaw &>/dev/null; then
      # Try to get context info from openclaw session
      SESSION_INFO=$(openclaw session-status 2>/dev/null || echo "")
      if echo "$SESSION_INFO" | grep -q "context_tokens"; then
        CONTEXT_TOKENS=$(echo "$SESSION_INFO" | grep -oP 'context_tokens["\s:]+(\d+)' | grep -oP '\d+' | head -1)
      fi
    fi
    
    # Load thresholds
    HOUR=$(date +%H)
    MAX_CONTEXT=$(python3 -c "
import json
d = json.load(open('$THRESHOLDS_FILE'))
p = 'workingHours' if $HOUR >= 9 and $HOUR < 18 else 'idleHours'
print(d[p]['maxContext'])
" 2>/dev/null || echo "200000")
    
    TRIGGER_PCT=$(python3 -c "
import json
d = json.load(open('$THRESHOLDS_FILE'))
p = 'workingHours' if $HOUR >= 9 and $HOUR < 18 else 'idleHours'
print(d[p]['triggerPct'])
" 2>/dev/null || echo "70")
    
    TRIGGER_THRESHOLD=$((MAX_CONTEXT * TRIGGER_PCT / 100))
    
    echo "Current Context: ${CONTEXT_TOKENS:-unknown} tokens"
    echo "Max Context: $MAX_CONTEXT tokens"
    echo "Trigger Threshold: $TRIGGER_PCT% ($TRIGGER_THRESHOLD tokens)"
    
    if [[ "$CONTEXT_TOKENS" -gt 0 && "$CONTEXT_TOKENS" -ge "$TRIGGER_THRESHOLD" ]]; then
      echo "⚠️  Threshold exceeded! Context at $((CONTEXT_TOKENS * 100 / MAX_CONTEXT))%"
      if $AUTO_COMPRESS; then
        echo "→ Auto-compressing..."
        bash "$0" compress --force
      else
        echo "→ Run 'context-ctl.sh compress --force' or 'context-ctl.sh monitor --auto-compress'"
      fi
    elif [[ "$CONTEXT_TOKENS" -gt 0 ]]; then
      echo "✅ Context healthy ($((CONTEXT_TOKENS * 100 / MAX_CONTEXT))% used)"
    else
      echo "ℹ️  Run openclaw session-status to get current context"
    fi
    ;;

  heartbeat)
    # Designed for HEARTBEAT.md - automatically checks and compresses if needed
    echo "=== Context Heartbeat Check ==="
    
    # Get context tokens
    CONTEXT_TOKENS=0
    if command -v openclaw &>/dev/null; then
      SESSION_INFO=$(openclaw session-status 2>/dev/null || echo "")
      if echo "$SESSION_INFO" | grep -q "context_tokens"; then
        CONTEXT_TOKENS=$(echo "$SESSION_INFO" | grep -oP 'context_tokens["\s:]+(\d+)' | grep -oP '\d+' | head -1)
      fi
    fi
    
    if [[ "$CONTEXT_TOKENS" -eq 0 ]]; then
      echo "ℹ️  No session context info available (normal for cron/isolated sessions)"
      exit 0
    fi
    
    HOUR=$(date +%H)
    
    # Load model context limit
    MODEL_CONTEXT=$(python3 -c "
import json
d = json.load(open('$THRESHOLDS_FILE'))
print(d.get('modelContextLimit', 128000))
" 2>/dev/null || echo "128000")
    
    # Use the smaller of configured max vs model limit
    MAX_CONTEXT=$(python3 -c "
import json
d = json.load(open('$THRESHOLDS_FILE'))
HOUR=\$(date +%H)
p = 'workingHours' if \$HOUR >= 9 and \$HOUR < 18 else 'idleHours'
cfg_max = d[p]['maxContext']
model_limit = $MODEL_CONTEXT
print(min(cfg_max, model_limit))
" 2>/dev/null || echo "128000")
    
    TRIGGER_PCT=$(python3 -c "
import json
d = json.load(open('$THRESHOLDS_FILE'))
HOUR=\$(date +%H)
p = 'workingHours' if \$HOUR >= 9 and \$HOUR < 18 else 'idleHours'
print(d[p]['triggerPct'])
" 2>/dev/null || echo "70")
    
    TRIGGER_THRESHOLD=$((MAX_CONTEXT * TRIGGER_PCT / 100))
    USAGE_PCT=$((CONTEXT_TOKENS * 100 / MAX_CONTEXT))
    
    echo "Context: ${CONTEXT_TOKENS} / $MAX_CONTEXT tokens ($USAGE_PCT%)"
    echo "Threshold: $TRIGGER_PCT% ($TRIGGER_THRESHOLD tokens)"
    
    if [[ "$CONTEXT_TOKENS" -ge "$TRIGGER_THRESHOLD" ]]; then
      echo "⚠️  Compressing..."
      bash "$0" compress --force
      echo "✅ Compression triggered via heartbeat"
    else
      echo "✅ Context healthy"
    fi
    ;;

  compress)
    FORCE=false
    DRYRUN=false
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --force) FORCE=true; shift ;;
        --dry-run) DRYRUN=true; shift ;;
        *) shift ;;
      esac
    done
    echo "=== Context Compression ==="
    if $DRYRUN; then
      echo "[DRY RUN] Would compress current session context"
      echo "Summary would be written to: $SUMMARY_FILE"
      echo "Compression event would be logged to: $COMPRESSION_LOG"
    else
      echo "Triggering compression..."
      TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
      # Append to compression log
      python3 -c "
import json
log = json.load(open('$COMPRESSION_LOG'))
log.append({'timestamp': '$TIMESTAMP', 'trigger': 'force' if $FORCE else 'threshold', 'success': True})
json.dump(log, open('$COMPRESSION_LOG', 'w'), indent=2)
print('Compression event logged.')
" 2>/dev/null
      echo "Done. Run auto_summarize.sh or update memory/context-summary.md manually."
    fi
    ;;

  track)
    FILES=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --files) FILES="$2"; shift 2 ;; *) shift ;; esac
    done
    if [[ -z "$FILES" ]]; then echo "Usage: context-ctl.sh track --files 'a.ts,b.ts'"; exit 1; fi
    echo "=== Tracking Files ==="
    # Append to summary
    {
      echo ""
      echo "## Files Modified ($(date +%Y-%m-%d\ %H:%M))"
      IFS=',' read -ra FARR <<< "$FILES"
      for f in "${FARR[@]}"; do echo "- ${f// /}"; done
    } >> "$SUMMARY_FILE"
    echo "Tracked: $FILES → $SUMMARY_FILE"
    ;;

  decide)
    TEXT=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --text) TEXT="$2"; shift 2 ;; *) shift ;; esac
    done
    if [[ -z "$TEXT" ]]; then echo "Usage: context-ctl.sh decide --text '...'"; exit 1; fi
    {
      echo ""
      echo "## Decision ($(date +%Y-%m-%d\ %H:%M))"
      echo "- $TEXT"
    } >> "$SUMMARY_FILE"
    echo "Decision recorded."
    ;;

  next)
    TEXT=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --text) TEXT="$2"; shift 2 ;; *) shift ;; esac
    done
    if [[ -z "$TEXT" ]]; then echo "Usage: context-ctl.sh next --text '...'"; exit 1; fi
    {
      echo ""
      echo "## Next Step ($(date +%Y-%m-%d\ %H:%M))"
      echo "- [ ] $TEXT"
    } >> "$SUMMARY_FILE"
    echo "Next step added."
    ;;

  archive)
    SESSION_ID=""
    TAGS=""
    IMPORTANCE="medium"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --session-id) SESSION_ID="$2"; shift 2 ;;
        --tags) TAGS="$2"; shift 2 ;;
        --importance) IMPORTANCE="$2"; shift 2 ;;
        --auto-tag) shift ;;
        *) shift ;;
      esac
    done
    if [[ -z "$SESSION_ID" ]]; then echo "Usage: context-ctl.sh archive --session-id ID"; exit 1; fi
    ARCHIVE_ID="archive-$(date +%Y%m%d-%H%M%S)-$(head -c4 /dev/urandom | xxd -p)"
    ARCHIVE_FILE="$ARCHIVE_DIR/${ARCHIVE_ID}.json"
    python3 -c "
import json
from datetime import datetime
archive = {
    'id': '$ARCHIVE_ID',
    'createdAt': datetime.utcnow().isoformat() + 'Z',
    'sessionId': '$SESSION_ID',
    'importance': '$IMPORTANCE',
    'tags': [t.strip() for t in '$TAGS'.split(',') if t.strip()],
    'summaryFile': '$SUMMARY_FILE'
}
json.dump(archive, open('$ARCHIVE_FILE', 'w'), indent=2)
print(f'Archived: {archive[\"id\"]}')
"
    ;;

  search)
    QUERY="${1:-}"
    shift || true
    LIMIT=10
    while [[ $# -gt 0 ]]; do
      case "$1" in --limit) LIMIT="$2"; shift 2 ;; --threshold) shift 2 ;; *) shift ;; esac
    done
    if [[ -z "$QUERY" ]]; then echo "Usage: context-ctl.sh search 'query'"; exit 1; fi
    echo "=== Archive Search: '$QUERY' ==="
    # Simple keyword search across archive JSON files
    grep -ril "$QUERY" "$ARCHIVE_DIR"/*.json 2>/dev/null | head -n "$LIMIT" | while read -r f; do
      python3 -c "
import json
d = json.load(open('$f'))
print(f\"  [{d.get('importance','?')}] {d['id']} | session={d.get('sessionId','?')} | tags={d.get('tags',[])} | {d.get('createdAt','?')}\")
" 2>/dev/null
    done || echo "No matching archives found."
    ;;

  list)
    OLDER_THAN=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --older-than) OLDER_THAN="$2"; shift 2 ;; *) shift ;; esac
    done
    echo "=== Archived Memories ==="
    for f in "$ARCHIVE_DIR"/*.json; do
      [[ -f "$f" ]] || { echo "No archives found."; break; }
      python3 -c "
import json
d = json.load(open('$f'))
print(f\"  {d['id']} | {d.get('importance','?')} | tags={d.get('tags',[])} | {d.get('createdAt','?')}\")
" 2>/dev/null
    done
    ;;

  retrieve)
    ID=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --id) ID="$2"; shift 2 ;; *) shift ;; esac
    done
    if [[ -z "$ID" ]]; then echo "Usage: context-ctl.sh retrieve --id ARCHIVE_ID"; exit 1; fi
    FOUND=$(find "$ARCHIVE_DIR" -name "${ID}*" 2>/dev/null | head -1)
    if [[ -n "$FOUND" ]]; then
      cat "$FOUND"
    else
      echo "Archive not found: $ID"
    fi
    ;;

  consolidate)
    TOPIC=""
    DRYRUN=false
    while [[ $# -gt 0 ]]; do
      case "$1" in --topic) TOPIC="$2"; shift 2 ;; --dry-run) DRYRUN=true; shift ;; *) shift ;; esac
    done
    if [[ -z "$TOPIC" ]]; then echo "Usage: context-ctl.sh consolidate --topic 'topic'"; exit 1; fi
    echo "=== Consolidating: '$TOPIC' ==="
    MATCHES=$(grep -ril "$TOPIC" "$ARCHIVE_DIR"/*.json 2>/dev/null | wc -l)
    echo "Found $MATCHES matching archives."
    if $DRYRUN; then
      echo "[DRY RUN] Would merge $MATCHES archives into single consolidated entry."
    else
      echo "Consolidation requires manual review. Use search + retrieve to inspect matches first."
    fi
    ;;

  prune)
    OLDER_THAN=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --older-than) OLDER_THAN="$2"; shift 2 ;; *) shift ;; esac
    done
    if [[ -z "$OLDER_THAN" ]]; then echo "Usage: context-ctl.sh prune --older-than 180d"; exit 1; fi
    DAYS="${OLDER_THAN//[!0-9]/}"
    echo "=== Pruning archives older than ${DAYS} days ==="
    find "$ARCHIVE_DIR" -name "*.json" -mtime +"$DAYS" -print -delete 2>/dev/null || echo "Nothing to prune."
    ;;

  help|*)
    cat <<'HELP'
context-ctl.sh — Unified context lifecycle CLI

Commands:
  status                          Token usage, thresholds, summary age
  stats                           Compression history & metrics
  monitor [--auto-compress]       Check token usage, optionally auto-compress
  heartbeat                       For HEARTBEAT.md - auto-compress if threshold exceeded
  compress [--force] [--dry-run]  Trigger compression
  track --files "a,b"             Track modified files
  decide --text "..."             Record a decision
  next --text "..."               Add a next step
  archive --session-id ID [--tags "t1,t2"] [--importance high]
  search "query" [--limit N]      Search archived memories
  list [--older-than Nd]          List archives
  retrieve --id ID                Get specific archive
  consolidate --topic "..." [--dry-run]  Merge related archives
  prune --older-than Nd           Remove old archives
HELP
    ;;
esac
