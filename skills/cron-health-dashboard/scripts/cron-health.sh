#!/usr/bin/env bash
# cron-health.sh — OpenClaw Cron Health Dashboard (Telegram-friendly)
# Usage: bash cron-health.sh <command> [options]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
REFS_DIR="$BASE_DIR/references"

mkdir -p "$REFS_DIR"

CMD="${1:-report}"
shift || true

fetch_cron_list() {
  openclaw cron list --json 2>/dev/null | awk '/^\{/,0' || echo '{"jobs":[]}'
}

parse_and_report() {
  local MODE="$1"
  local FILTER="${2:-}"
  local JSON
  JSON=$(fetch_cron_list)
  
  local TOTAL_JOBS=0
  local OK_JOBS=()
  local STUCK_JOBS=()
  local FAILED_JOBS=()
  
  # Parse jobs
  local NOW_MS
  NOW_MS=$(date +%s)000
  
  for job_id in $(echo "$JSON" | jq -r '.jobs[].id' 2>/dev/null); do
    local job_info job_name next_run last_status
    job_info=$(echo "$JSON" | jq ".jobs[] | select(.id == \"$job_id\")" 2>/dev/null)
    job_name=$(echo "$job_info" | jq -r '.name' 2>/dev/null)
    next_run=$(echo "$job_info" | jq -r '.state.nextRunAtMs' 2>/dev/null)
    last_status=$(echo "$job_info" | jq -r '.state.lastRunStatus' 2>/dev/null)
    
    # Skip self-check to avoid false positive
    [[ "$job_name" == *"Health Check" ]] && continue
    
    # Apply filter
    if [[ -n "$FILTER" && "$job_name" != *"$FILTER"* && "$job_id" != *"$FILTER"* ]]; then
      continue
    fi
    
    TOTAL_JOBS=$((TOTAL_JOBS + 1))
    
    if [[ "$next_run" != "null" && -n "$next_run" && "$next_run" != "0" ]]; then
      if [[ "$next_run" -lt "$NOW_MS" ]]; then
        STUCK_JOBS+=("$job_name")
      else
        OK_JOBS+=("$job_name")
      fi
    elif [[ "$last_status" == "failed" || "$last_status" == "error" ]]; then
      FAILED_JOBS+=("$job_name")
    else
      OK_JOBS+=("$job_name")
    fi
  done
  
  local STUCK=${#STUCK_JOBS[@]}
  local FAILED=${#FAILED_JOBS[@]}
  local OK=${#OK_JOBS[@]}
  local TOTAL=$OK
  
  # Output Telegram-friendly format
  echo "Cron Health: $TOTAL OK, $((STUCK + FAILED)) issues"
  echo ""
  echo "| Status | Job |"
  echo "|--------|-----|"
  
  for job in "${OK_JOBS[@]}"; do
    echo "| ✅ | $job |"
  done
  for job in "${STUCK_JOBS[@]}"; do
    echo "| ⚠️ stuck | $job |"
  done
  for job in "${FAILED_JOBS[@]}"; do
    echo "| ❌ failed | $job |"
  done
  
  [[ $((STUCK + FAILED)) -gt 0 ]] && exit 1 || exit 0
}

case "$CMD" in
  report|summary)
    parse_and_report "report"
    ;;
  problems)
    parse_and_report "problems"
    ;;
  check)
    QUERY="${1:-}"
    [[ -z "$QUERY" ]] && echo "Usage: cron-health.sh check 'name'" && exit 1
    parse_and_report "report" "$QUERY"
    ;;
  fix)
    echo "Auto-fix not implemented in this version"
    ;;
  archive)
    mkdir -p "$REFS_DIR/history"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    JSON=$(fetch_cron_list)
    echo "$JSON" > "$REFS_DIR/history/$TIMESTAMP.json"
    echo "✅ Archived to: $REFS_DIR/history/$TIMESTAMP.json"
    ;;
  history)
    DAYS="${1:-7}"
    echo "=== Cron History (last $DAYS days) ==="
    [[ ! -d "$REFS_DIR/history" ]] && echo "No history" && exit 0
    find "$REFS_DIR/history" -name "*.json" -mtime -"$DAYS" 2>/dev/null | sort | while read -f; do
      basename "$f" .json
    done
    ;;
  help|*)
    echo "cron-health.sh — Usage:"
    echo "  report         Full health report (Telegram format)"
    echo "  summary        Same as report"
    echo "  problems       Show only problems"
    echo "  check 'name'   Check specific job"
    echo "  archive        Save to history"
    ;;
esac
