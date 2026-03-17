#!/usr/bin/env bash
# dispatch.sh — Event-Driven Orchestrator CLI
# Usage: bash dispatch.sh <command> [options]
#
# Commands:
#   emit        Dispatch an event to registered handlers
#   list        List all registered handlers
#   register    Register a new handler
#   unregister  Remove a handler
#   retry       Retry a failed handler execution
#   retry-failed  Retry all failed events from log
#   log         View event audit trail
#   stats       Event statistics
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF_DIR="$SCRIPT_DIR/../references"
HANDLERS_FILE="$REF_DIR/handlers.json"
LOG_FILE="$REF_DIR/event-log.jsonl"

# Ensure files exist
mkdir -p "$REF_DIR"
[ -f "$HANDLERS_FILE" ] || echo '{"handlers":[]}' > "$HANDLERS_FILE"
[ -f "$LOG_FILE" ] || touch "$LOG_FILE"

CMD="${1:-help}"
shift || true

# Parse common flags
EVENT=""
SOURCE=""
PAYLOAD="{}"
DRY_RUN=false
HANDLER_CMD=""
THROTTLE=0
DEDUP_KEY=""
HANDLER_ID=""
LAST=20
DAYS=7

while [[ $# -gt 0 ]]; do
  case "$1" in
    --event) EVENT="$2"; shift 2 ;;
    --source) SOURCE="$2"; shift 2 ;;
    --payload) PAYLOAD="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --handler) HANDLER_CMD="$2"; shift 2 ;;
    --throttle) THROTTLE="$2"; shift 2 ;;
    --dedup-key) DEDUP_KEY="$2"; shift 2 ;;
    --id) HANDLER_ID="$2"; shift 2 ;;
    --last) LAST="$2"; shift 2 ;;
    --days) DAYS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

now_epoch() { date +%s; }
now_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
gen_id() { echo "evt-$(date +%Y%m%d)-$(printf '%03d' $((RANDOM % 1000)))"; }

log_event() {
  local evt="$1" src="$2" handler="$3" result="$4" dur="$5" payload="$6"
  local entry
  entry=$(jq -nc \
    --arg id "$(gen_id)" \
    --arg event "$evt" \
    --arg source "$src" \
    --arg ts "$(now_iso)" \
    --arg handler "$handler" \
    --arg result "$result" \
    --argjson dur "$dur" \
    --argjson payload "$payload" \
    '{id:$id,event:$event,source:$source,timestamp:$ts,payload:$payload,handler:$handler,result:$result,durationMs:$dur}')
  echo "$entry" >> "$LOG_FILE"
}

check_throttle() {
  local dedup="$1" throttle="$2"
  if [ "$throttle" -le 0 ] || [ -z "$dedup" ]; then
    return 1  # no throttle → allow
  fi
  local now
  now=$(now_epoch)
  local last_ts
  last_ts=$(grep "\"dedupKey\":\"$dedup\"" "$LOG_FILE" 2>/dev/null | tail -1 | jq -r '.timestamp // empty' 2>/dev/null || echo "")
  if [ -z "$last_ts" ]; then
    return 1  # never ran → allow
  fi
  local last_epoch
  last_epoch=$(date -d "$last_ts" +%s 2>/dev/null || echo 0)
  local diff=$((now - last_epoch))
  if [ "$diff" -lt "$throttle" ]; then
    return 0  # throttled
  fi
  return 1  # allow
}

case "$CMD" in

  emit)
    if [ -z "$EVENT" ]; then
      echo "Error: --event required"
      exit 1
    fi
    SOURCE="${SOURCE:-manual}"
    echo "=== Dispatching: $EVENT (source: $SOURCE) ==="

    # Find matching handlers
    MATCHES=$(jq -r --arg evt "$EVENT" \
      '.handlers[] | select(.event == $evt and .enabled == true) | @json' \
      "$HANDLERS_FILE" 2>/dev/null)

    if [ -z "$MATCHES" ]; then
      echo "  No handlers registered for '$EVENT'"
      log_event "$EVENT" "$SOURCE" "none" "no-handler" 0 "$PAYLOAD"
      exit 0
    fi

    echo "$MATCHES" | while IFS= read -r h; do
      hid=$(echo "$h" | jq -r '.id')
      hcmd=$(echo "$h" | jq -r '.handler')
      hthrottle=$(echo "$h" | jq -r '.throttleSec // 0')
      hdedup=$(echo "$h" | jq -r '.dedupKey // ""')

      echo "  Handler: $hid → $hcmd"

      # Check throttle
      if [ "$hthrottle" -gt 0 ] && [ -n "$hdedup" ]; then
        if check_throttle "$hdedup" "$hthrottle"; then
          echo "    ⏳ Throttled (${hthrottle}s window, dedup: $hdedup)"
          log_event "$EVENT" "$SOURCE" "$hcmd" "throttled" 0 "$PAYLOAD"
          continue
        fi
      fi

      if $DRY_RUN; then
        echo "    🔍 Dry run — would execute: $hcmd"
        continue
      fi

      # Execute handler
      local_start=$(now_epoch)
      if eval "$hcmd" 2>&1; then
        local_end=$(now_epoch)
        dur_ms=$(( (local_end - local_start) * 1000 ))
        echo "    ✅ OK (${dur_ms}ms)"
        # Log with dedupKey for throttle tracking
        entry=$(jq -nc \
          --arg id "$(gen_id)" \
          --arg event "$EVENT" \
          --arg source "$SOURCE" \
          --arg ts "$(now_iso)" \
          --arg handler "$hcmd" \
          --arg result "ok" \
          --argjson dur "$dur_ms" \
          --argjson payload "$PAYLOAD" \
          --arg dedup "$hdedup" \
          '{id:$id,event:$event,source:$source,timestamp:$ts,payload:$payload,handler:$handler,result:$result,durationMs:$dur,dedupKey:$dedup}')
        echo "$entry" >> "$LOG_FILE"
      else
        local_end=$(now_epoch)
        dur_ms=$(( (local_end - local_start) * 1000 ))
        echo "    ❌ Failed (${dur_ms}ms)"
        entry=$(jq -nc \
          --arg id "$(gen_id)" \
          --arg event "$EVENT" \
          --arg source "$SOURCE" \
          --arg ts "$(now_iso)" \
          --arg handler "$hcmd" \
          --arg result "error" \
          --argjson dur "$dur_ms" \
          --argjson payload "$PAYLOAD" \
          --arg dedup "$hdedup" \
          '{id:$id,event:$event,source:$source,timestamp:$ts,payload:$payload,handler:$handler,result:$result,durationMs:$dur,dedupKey:$dedup}')
        echo "$entry" >> "$LOG_FILE"
      fi
    done
    ;;

  list)
    echo "=== Registered Handlers ==="
    jq -r '.handlers[] | "  [\(.id)] \(.event) → \(.handler) (throttle: \(.throttleSec // 0)s, enabled: \(.enabled))"' "$HANDLERS_FILE"
    COUNT=$(jq '.handlers | length' "$HANDLERS_FILE")
    echo ""
    echo "Total: $COUNT handler(s)"
    ;;

  register)
    if [ -z "$EVENT" ] || [ -z "$HANDLER_CMD" ]; then
      echo "Error: --event and --handler required"
      exit 1
    fi
    NEW_ID="h-$(printf '%03d' $(( $(jq '.handlers | length' "$HANDLERS_FILE") + 1 )))"
    [ -n "$HANDLER_ID" ] && NEW_ID="$HANDLER_ID"
    jq --arg id "$NEW_ID" \
       --arg evt "$EVENT" \
       --arg hcmd "$HANDLER_CMD" \
       --argjson throttle "$THROTTLE" \
       --arg dedup "$DEDUP_KEY" \
       '.handlers += [{"id":$id,"event":$evt,"handler":$hcmd,"throttleSec":$throttle,"dedupKey":$dedup,"enabled":true}]' \
       "$HANDLERS_FILE" > "${HANDLERS_FILE}.tmp" && mv "${HANDLERS_FILE}.tmp" "$HANDLERS_FILE"
    echo "✅ Registered: $NEW_ID → $EVENT → $HANDLER_CMD"
    ;;

  unregister)
    if [ -z "$HANDLER_ID" ]; then
      echo "Error: --id required"
      exit 1
    fi
    jq --arg id "$HANDLER_ID" '.handlers |= map(select(.id != $id))' \
       "$HANDLERS_FILE" > "${HANDLERS_FILE}.tmp" && mv "${HANDLERS_FILE}.tmp" "$HANDLERS_FILE"
    echo "✅ Unregistered: $HANDLER_ID"
    ;;

  log)
    echo "=== Event Log ==="
    if [ -n "$EVENT" ]; then
      grep "\"event\":\"$EVENT\"" "$LOG_FILE" | tail -n "$LAST" | jq -r '"  [\(.timestamp)] \(.event) → \(.result) (\(.handler))"'
    else
      tail -n "$LAST" "$LOG_FILE" | jq -r '"  [\(.timestamp)] \(.event) → \(.result) (\(.handler))"'
    fi
    ;;

  stats)
    echo "=== Event Stats (last ${DAYS} days) ==="
    if [ ! -s "$LOG_FILE" ]; then
      echo "  (no events logged yet)"
      exit 0
    fi
    TOTAL=$(wc -l < "$LOG_FILE")
    OK=$(grep -c '"result":"ok"' "$LOG_FILE" || true)
    ERR=$(grep -c '"result":"error"' "$LOG_FILE" || true)
    THROTTLED=$(grep -c '"result":"throttled"' "$LOG_FILE" || true)
    NO_HANDLER=$(grep -c '"result":"no-handler"' "$LOG_FILE" || true)
    echo "  Total events: $TOTAL"
    echo "  ✅ OK: $OK"
    echo "  ❌ Error: $ERR"
    echo "  ⏳ Throttled: $THROTTLED"
    echo "  🔇 No handler: $NO_HANDLER"
    echo ""
    echo "  Top events:"
    jq -r '.event' "$LOG_FILE" 2>/dev/null | sort | uniq -c | sort -rn | head -5 | while read -r cnt evt; do
      echo "    $evt: $cnt"
    done
    ;;

  retry)
    # Retry a specific failed event by ID
    if [ -z "$EVENT" ]; then
      echo "Error: --event required (use event ID from log)"
      exit 1
    fi
    echo "=== Retrying failed event: $EVENT ==="
    
    # Find the original event in log
    ORIGINAL=$(grep "\"id\":\"$EVENT\"" "$LOG_FILE" | tail -1)
    if [ -z "$ORIGINAL" ]; then
      echo "Event not found in log: $EVENT"
      exit 1
    fi
    
    # Extract original details
    ORG_EVENT=$(echo "$ORIGINAL" | jq -r '.event')
    ORG_HANDLER=$(echo "$ORIGINAL" | jq -r '.handler')
    ORG_SOURCE=$(echo "$ORIGINAL" | jq -r '.source')
    ORG_PAYLOAD=$(echo "$ORIGINAL" | jq -r '.payload')
    
    if [ "$ORG_HANDLER" == "null" ] || [ -z "$ORG_HANDLER" ]; then
      echo "No handler to retry for event: $EVENT"
      exit 1
    fi
    
    echo "Re-executing: $ORG_HANDLER"
    
    if $DRY_RUN; then
      echo "  🔍 Dry run — would execute: $ORG_HANDLER"
      exit 0
    fi
    
    local_start=$(now_epoch)
    if eval "$ORG_HANDLER" 2>&1; then
      local_end=$(now_epoch)
      dur_ms=$(( (local_end - local_start) * 1000 ))
      echo "  ✅ Retry OK (${dur_ms}ms)"
      entry=$(jq -nc \
        --arg id "$(gen_id)" \
        --arg event "$ORG_EVENT" \
        --arg source "$ORG_SOURCE" \
        --arg ts "$(now_iso)" \
        --arg handler "$ORG_HANDLER" \
        --arg result "ok" \
        --argjson dur "$dur_ms" \
        --argjson payload "$ORG_PAYLOAD" \
        '{id:$id,event:$event,source:$source,timestamp:$ts,payload:$payload,handler:$handler,result:$result,durationMs:$dur,retryOf:$EVENT}')
      echo "$entry" >> "$LOG_FILE"
    else
      local_end=$(now_epoch)
      dur_ms=$(( (local_end - local_start) * 1000 ))
      echo "  ❌ Retry failed (${dur_ms}ms)"
      entry=$(jq -nc \
        --arg id "$(gen_id)" \
        --arg event "$ORG_EVENT" \
        --arg source "$ORG_SOURCE" \
        --arg ts "$(now_iso)" \
        --arg handler "$ORG_HANDLER" \
        --arg result "error" \
        --argjson dur "$dur_ms" \
        --argjson payload "$ORG_PAYLOAD" \
        '{id:$id,event:$event,source:$source,timestamp:$ts,payload:$payload,handler:$handler,result:$result,durationMs:$dur,retryOf:$EVENT}')
      echo "$entry" >> "$LOG_FILE"
    fi
    ;;

  retry-failed)
    # Retry all failed events
    MAX_RETRIES=5
    echo "=== Retrying all failed events (max $MAX_RETRIES per event) ==="
    
    FAILED_IDS=$(grep '"result":"error"' "$LOG_FILE" | jq -r '.id' | sort -u)
    
    if [ -z "$FAILED_IDS" ]; then
      echo "  No failed events to retry"
      exit 0
    fi
    
    COUNT=0
    for evt_id in $FAILED_IDS; do
      # Check retry count
      RETRY_COUNT=$(grep "\"retryOf\":\"$evt_id\"" "$LOG_FILE" 2>/dev/null | grep -c '"result":"ok"' || echo 0)
      if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
        echo "  ⏭️  Skipping $evt_id (max retries reached)"
        continue
      fi
      
      echo "  Retrying: $evt_id"
      bash "$0" retry --event "$evt_id" ${DRY_RUN:+"--dry-run"}
      COUNT=$((COUNT + 1))
    done
    
    echo "  Total retried: $COUNT"
    ;;

  help|*)
    cat <<'EOF'
Usage: bash dispatch.sh <command> [options]

Commands:
  emit          Dispatch an event to registered handlers
                --event <name> --source <heartbeat|cron|manual|webhook> [--payload '{}'] [--dry-run]
  list          List all registered handlers
  register      Register a new handler
                --event <name> --handler <command> [--throttle <sec>] [--dedup-key <key>] [--id <id>]
  unregister    Remove a handler by id
                --id <handler-id>
  retry         Retry a specific failed event
                --event <event-id> [--dry-run]
  retry-failed  Retry all failed events
                [--dry-run]
  log           View event audit trail
                [--event <name>] [--last <n>]
  stats         Event statistics
                [--days <n>]
EOF
    ;;
esac
