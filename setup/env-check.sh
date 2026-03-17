#!/usr/bin/env bash
# OpenClaw Environment Check Script
# 檢查當前環境同參考設定嘅差異，輸出 JSON 報告
# Usage: bash env-check.sh

set -euo pipefail

# === Reference values ===
REF_NODE_MAJOR=20
REF_NPM_MAJOR=10
REF_OC_VERSION="2026.3.13"
REF_OS="Ubuntu"

# === Colors ===
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# === Helper ===
status_icon() {
  case "$1" in
    ok)      echo -e "${GREEN}✅${NC}" ;;
    warn)    echo -e "${YELLOW}⚠️${NC}" ;;
    missing) echo -e "${RED}❌${NC}" ;;
  esac
}

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           OpenClaw 環境檢查報告                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

ISSUES=()
INSTALL_CMDS=()

# --- OS ---
OS_NAME=$(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "Unknown")
if echo "$OS_NAME" | grep -qi ubuntu; then
  OS_STATUS="ok"
else
  OS_STATUS="warn"
fi
echo -e "  OS              參考: ${BOLD}Ubuntu 24.04${NC}    你的: ${BOLD}${OS_NAME}${NC}  $(status_icon $OS_STATUS)"

# --- Architecture ---
ARCH=$(uname -m)
echo -e "  Architecture    ${BOLD}${ARCH}${NC}"

# --- Node.js ---
if command -v node &>/dev/null; then
  NODE_VER=$(node --version 2>/dev/null | sed 's/^v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge "$REF_NODE_MAJOR" ]; then
    NODE_STATUS="ok"
  else
    NODE_STATUS="warn"
    ISSUES+=("Node.js $NODE_VER < 需要 v${REF_NODE_MAJOR}+")
  fi
else
  NODE_VER="未安裝"
  NODE_STATUS="missing"
  ISSUES+=("Node.js 未安裝")
  INSTALL_CMDS+=("curl -fsSL https://deb.nodesource.com/setup_${REF_NODE_MAJOR}.x | sudo -E bash - && sudo apt-get install -y nodejs")
fi
echo -e "  Node.js         參考: ${BOLD}≥v${REF_NODE_MAJOR}.x${NC}         你的: ${BOLD}${NODE_VER}${NC}  $(status_icon $NODE_STATUS)"

# --- npm ---
if command -v npm &>/dev/null; then
  NPM_VER=$(npm --version 2>/dev/null)
  NPM_MAJOR=$(echo "$NPM_VER" | cut -d. -f1)
  if [ "$NPM_MAJOR" -ge "$REF_NPM_MAJOR" ]; then
    NPM_STATUS="ok"
  else
    NPM_STATUS="warn"
  fi
else
  NPM_VER="未安裝"
  NPM_STATUS="missing"
  ISSUES+=("npm 未安裝（裝 Node.js 會一齊裝）")
fi
echo -e "  npm             參考: ${BOLD}≥v${REF_NPM_MAJOR}.x${NC}         你的: ${BOLD}${NPM_VER}${NC}  $(status_icon $NPM_STATUS)"

# --- OpenClaw ---
if command -v openclaw &>/dev/null; then
  OC_VER=$(openclaw --version 2>/dev/null | head -1 | awk '{print $2}')
  OC_PATH=$(which openclaw)
  if [ "$OC_VER" = "$REF_OC_VERSION" ]; then
    OC_STATUS="ok"
  else
    OC_STATUS="warn"
    ISSUES+=("OpenClaw 版本 $OC_VER ≠ 參考版本 $REF_OC_VERSION")
  fi
else
  OC_VER="未安裝"
  OC_PATH="N/A"
  OC_STATUS="missing"
  ISSUES+=("OpenClaw 未安裝")
  INSTALL_CMDS+=("sudo npm install -g openclaw")
fi
echo -e "  OpenClaw        參考: ${BOLD}${REF_OC_VERSION}${NC}    你的: ${BOLD}${OC_VER}${NC}  $(status_icon $OC_STATUS)"
[ "$OC_PATH" != "N/A" ] && echo -e "                  路徑: ${OC_PATH}"

# --- ~/.openclaw/ directory ---
if [ -d "$HOME/.openclaw" ]; then
  OCDIR_STATUS="ok"
else
  OCDIR_STATUS="missing"
  ISSUES+=("~/.openclaw/ 目錄不存在（需要 openclaw onboard）")
  INSTALL_CMDS+=("openclaw onboard")
fi
echo -e "  ~/.openclaw/    ${BOLD}$([ -d "$HOME/.openclaw" ] && echo "存在" || echo "不存在")${NC}  $(status_icon $OCDIR_STATUS)"

# --- openclaw.json ---
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
  OCJSON_STATUS="ok"
  # Count providers
  PROVIDER_COUNT=$(python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
print(len(cfg.get('models',{}).get('providers',{})))
" 2>/dev/null || echo "?")
  # Count agents
  AGENT_COUNT=$(python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
print(len(cfg.get('agents',{}).get('list',[])))
" 2>/dev/null || echo "?")
  # Count cron jobs
  CRON_COUNT=$(python3 -c "
import json
with open('$HOME/.openclaw/cron/jobs.json') as f:
    cfg = json.load(f)
print(len(cfg.get('jobs',[])))
" 2>/dev/null || echo "0")
  # Count bindings
  BINDING_COUNT=$(python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
print(len(cfg.get('bindings',[])))
" 2>/dev/null || echo "0")
else
  OCJSON_STATUS="missing"
  PROVIDER_COUNT="0"
  AGENT_COUNT="0"
  CRON_COUNT="0"
  BINDING_COUNT="0"
  ISSUES+=("openclaw.json 不存在")
fi
echo -e "  openclaw.json   ${BOLD}$([ -f "$HOME/.openclaw/openclaw.json" ] && echo "存在" || echo "不存在")${NC}  $(status_icon $OCJSON_STATUS)"
echo -e "    Providers:    ${BOLD}${PROVIDER_COUNT}${NC}"
echo -e "    Agents:       ${BOLD}${AGENT_COUNT}${NC}"
echo -e "    Cron Jobs:    ${BOLD}${CRON_COUNT}${NC}"
echo -e "    TG Bindings:  ${BOLD}${BINDING_COUNT}${NC}"

# --- .env ---
echo ""
echo -e "${BOLD}  API Keys (.env):${NC}"
if [ -f "$HOME/.openclaw/.env" ]; then
  ENV_STATUS="ok"
  # Check each key
  while IFS= read -r key; do
    val=$(grep "^${key}=" "$HOME/.openclaw/.env" 2>/dev/null | cut -d= -f2-)
    if [ -n "$val" ] && [ "$val" != "" ]; then
      echo -e "    ${key}  $(status_icon ok)"
    else
      echo -e "    ${key}  $(status_icon missing) ${RED}未設定${NC}"
    fi
  done <<'KEYS'
OPENCLAW_GATEWAY_TOKEN
TELEGRAM_BOT_TOKEN
NVIDIA_INTEGRATE_API_KEY
NVIDIA_DEEPSEEK_AI_API_KEY
NVIDIA_QWEN_API_KEY
NVIDIA_Z_AI_API_KEY
POE_OC_API_KEY
POE_D_API_KEY
JINA_API_KEY
TAVILY_API_KEY
KEYS
else
  ENV_STATUS="missing"
  echo -e "    ${RED}.env 檔案不存在${NC}  $(status_icon missing)"
  ISSUES+=(".env 不存在（需要建立並填入 API keys）")
fi

# --- Plugins ---
echo ""
echo -e "${BOLD}  Plugins:${NC}"
if [ -d "$HOME/.openclaw/extensions/memory-lancedb-pro" ]; then
  echo -e "    memory-lancedb-pro  $(status_icon ok)"
else
  echo -e "    memory-lancedb-pro  $(status_icon missing) ${YELLOW}可選${NC}"
fi

# --- Telegram ---
echo ""
echo -e "${BOLD}  Telegram:${NC}"
TG_ENABLED=$(python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
print(cfg.get('channels',{}).get('telegram',{}).get('enabled', False))
" 2>/dev/null || echo "False")
if [ "$TG_ENABLED" = "True" ]; then
  echo -e "    Channel 已啟用  $(status_icon ok)"
else
  echo -e "    Channel 未啟用  $(status_icon missing) ${YELLOW}可選${NC}"
fi

# --- Agent Directories ---
echo ""
echo -e "${BOLD}  Agent 目錄:${NC}"
if [ -d "$HOME/.openclaw/agents" ]; then
  for agent_dir in "$HOME/.openclaw/agents"/*/; do
    agent_name=$(basename "$agent_dir")
    has_models="❌"
    has_auth="❌"
    [ -f "${agent_dir}agent/models.json" ] && has_models="✅"
    [ -f "${agent_dir}agent/auth.json" ] && has_auth="✅"
    echo -e "    ${agent_name}:  models.json=${has_models}  auth.json=${has_auth}"
  done
else
  echo -e "    ${RED}agents/ 目錄不存在${NC}"
fi

# --- Summary ---
echo ""
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════${NC}"

if [ ${#ISSUES[@]} -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ✅ 環境完全就緒！可以直接使用。${NC}"
else
  echo -e "${YELLOW}${BOLD}  需要處理 ${#ISSUES[@]} 個項目：${NC}"
  for issue in "${ISSUES[@]}"; do
    echo -e "    ${RED}•${NC} $issue"
  done

  if [ ${#INSTALL_CMDS[@]} -gt 0 ]; then
    echo ""
    echo -e "${BOLD}  自動安裝指令：${NC}"
    for cmd in "${INSTALL_CMDS[@]}"; do
      echo -e "    ${CYAN}\$ $cmd${NC}"
    done
  fi
fi

echo ""

# --- JSON output for programmatic use ---
cat <<ENDJSON > /tmp/openclaw-env-check.json
{
  "os": "$(echo "$OS_NAME" | tr '"' "'")",
  "arch": "$ARCH",
  "node": "$NODE_VER",
  "npm": "${NPM_VER:-unknown}",
  "openclaw": "$OC_VER",
  "openclawDir": $([ -d "$HOME/.openclaw" ] && echo "true" || echo "false"),
  "openclawJson": $([ -f "$HOME/.openclaw/openclaw.json" ] && echo "true" || echo "false"),
  "envFile": $([ -f "$HOME/.openclaw/.env" ] && echo "true" || echo "false"),
  "providers": $PROVIDER_COUNT,
  "agents": $AGENT_COUNT,
  "cronJobs": $CRON_COUNT,
  "bindings": $BINDING_COUNT,
  "telegram": $([ "$TG_ENABLED" = "True" ] && echo "true" || echo "false"),
  "memoryPlugin": $([ -d "$HOME/.openclaw/extensions/memory-lancedb-pro" ] && echo "true" || echo "false"),
  "issueCount": ${#ISSUES[@]}
}
ENDJSON
echo -e "${CYAN}  JSON 報告已寫入 /tmp/openclaw-env-check.json${NC}"
