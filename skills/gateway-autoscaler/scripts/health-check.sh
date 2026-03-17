#!/bin/bash
# Gateway Autoscaler - Health Check Script
# Usage: bash health-check.sh [--auto-restart] [--json]

set -e

AUTO_RESTART=false
JSON_OUTPUT=false
LOG_FILE="/tmp/openclaw/openclaw-$(date +%Y-%m-%d).log"

# Parse args
for arg in "$@"; do
  case $arg in
    --auto-restart) AUTO_RESTART=true ;;
    --json) JSON_OUTPUT=true ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
log_info() { echo "[INFO] $1"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_error() { echo -e "${RED}[ERROR] $1${NC}"; }

# Check gateway status
check_gateway_status() {
  if openclaw status >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Get restart count from journal
get_restart_count() {
  journalctl --user -u openclaw-gateway --since "1 hour ago" 2>/dev/null | \
    grep -c "Started OpenClaw Gateway" || true
}

# Check crash loop
check_crash_loop() {
  local restarts=$(get_restart_count)
  if [ "$restarts" -gt 10 ]; then
    return 2  # Critical
  elif [ "$restarts" -gt 3 ]; then
    return 1  # Warning
  fi
  return 0
}

# Get recent errors from log
get_recent_errors() {
  if [ -f "$LOG_FILE" ]; then
    tail -100 "$LOG_FILE" | grep -v '^{' | grep -iE "error|exception|fatal|crash" | tail -5 || echo ""
  else
    echo ""
  fi
}

# Main health check
run_health_check() {
  local status="healthy"
  local restarts=$(get_restart_count)
  local errors=()
  
  # Check basic connectivity
  if ! check_gateway_status; then
    status="unhealthy"
    errors+=("Gateway not responding")
  fi
  
  # Check crash loop
  local crash_status
  check_crash_loop
  crash_status=$?
  
  if [ $crash_status -eq 2 ]; then
    status="critical"
    errors+=("Crash loop detected ($restarts restarts in 1h)")
  elif [ $crash_status -eq 1 ]; then
    status="degraded"
    errors+=("High restart count ($restarts in 1h)")
  fi
  
  # Get recent errors
  local recent_errors
  recent_errors=$(get_recent_errors)
  
  # Output
  if [ "$JSON_OUTPUT" = true ]; then
    local errors_json="[]"
    if [ ${#errors[@]} -gt 0 ]; then
      errors_json=$(printf '%s\n' "${errors[@]}" | jq -R . | jq -s .)
    fi
    cat <<EOF
{
  "status": "$status",
  "restarts_1h": $restarts,
  "errors": $errors_json,
  "log_errors": $(echo "$recent_errors" | jq -R . | jq -s . 2>/dev/null || echo "[]"),
  "timestamp": "$(date -Iseconds)"
}
EOF
  else
    echo "========================================"
    echo "       Gateway Health Report"
    echo "========================================"
    echo "Status: $status"
    echo "Restarts (1h): $restarts"
    echo ""
    if [ ${#errors[@]} -gt 0 ]; then
      echo "Errors:"
      for err in "${errors[@]}"; do
        echo "  - $err"
      done
    fi
    echo ""
    echo "Recent log errors:"
    echo "$recent_errors"
    echo "========================================"
  fi
  
  # Auto-restart if enabled and unhealthy
  if [ "$AUTO_RESTART" = true ] && [ "$status" = "unhealthy" ]; then
    log_warn "Gateway unhealthy, attempting restart..."
    openclaw gateway restart
    if check_gateway_status; then
      log_info "Gateway restarted successfully"
    else
      log_error "Failed to restart gateway"
      exit 1
    fi
  fi
  
  # Exit code based on status
  case $status in
    healthy) exit 0 ;;
    degraded) exit 1 ;;
    unhealthy|critical) exit 2 ;;
  esac
}

run_health_check
