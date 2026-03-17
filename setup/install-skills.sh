#!/usr/bin/env bash
# OpenClaw Skills Installer
# 從 bundle 安裝 skills 到 OpenClaw workspace + Claude Code
# Usage:
#   bash install-skills.sh --all                    # 安裝全部
#   bash install-skills.sh --category core,memory   # 安裝指定分類
#   bash install-skills.sh --pick                   # 互動選擇
#   bash install-skills.sh --list                   # 列出分類
#   bash install-skills.sh --check                  # 檢查已安裝

set -euo pipefail

# === Paths ===
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Detect context: running from bundle (setup/) or from skill dir directly
if [ -f "$SCRIPT_DIR/../skills-manifest.json" ]; then
  # Running from bundle: setup/install-skills.sh
  BUNDLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  MANIFEST="$BUNDLE_DIR/skills-manifest.json"
  SKILLS_SRC="$BUNDLE_DIR/skills"
elif [ -f "$SCRIPT_DIR/skills-manifest.json" ]; then
  # Running from skill dir: openclaw-setup-guide/install-skills.sh
  MANIFEST="$SCRIPT_DIR/skills-manifest.json"
  SKILLS_SRC="$HOME/.openclaw/workspace/skills"
else
  echo "❌ skills-manifest.json not found"
  echo "請喺 openclaw-skills-bundle/ 或 openclaw-setup-guide/ 目錄入面執行"
  exit 1
fi

OC_SKILLS_DIR="$HOME/.openclaw/workspace/skills"
CC_SKILLS_DIR="$HOME/.claude/skills"

# === Colors ===
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# === Check prerequisites ===
if [ ! -f "$MANIFEST" ]; then
  echo -e "${RED}❌ skills-manifest.json not found at $MANIFEST${NC}"
  echo "請確保你喺 openclaw-skills-bundle/ 目錄入面執行"
  exit 1
fi

if [ ! -d "$SKILLS_SRC" ]; then
  echo -e "${RED}❌ skills/ directory not found${NC}"
  exit 1
fi

# === Parse manifest ===
get_categories() {
  python3 -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
for cat_id, cat in m['categories'].items():
    skills = cat['skills']
    req = cat.get('requires', [])
    req_str = ' (需要 ' + ', '.join(req) + ')' if req else ''
    print(f\"{cat_id}|{cat['label']}|{len(skills)}|{cat['description']}{req_str}\")
"
}

get_skills_in_category() {
  python3 -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
cat = m['categories'].get('$1', {})
for s in cat.get('skills', []):
    desc = m['skills'].get(s, {}).get('description', '')
    print(f'{s}|{desc}')
"
}

get_all_skills() {
  python3 -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
for s, info in m['skills'].items():
    print(f\"{s}|{info['description']}\")
"
}

# === Install one skill ===
install_skill() {
  local skill_name="$1"
  local src="$SKILLS_SRC/$skill_name"

  if [ ! -d "$src" ]; then
    echo -e "  ${YELLOW}⏭️  $skill_name (bundle 入面搵唔到，跳過)${NC}"
    return 1
  fi

  # Install to OpenClaw workspace
  local oc_dest="$OC_SKILLS_DIR/$skill_name"
  if [ -d "$oc_dest" ] || [ -L "$oc_dest" ]; then
    # Remove existing symlink or dir
    rm -rf "$oc_dest"
  fi
  cp -r "$src" "$oc_dest"

  # Create symlink in Claude Code skills
  local cc_dest="$CC_SKILLS_DIR/$skill_name"
  if [ -e "$cc_dest" ] || [ -L "$cc_dest" ]; then
    rm -rf "$cc_dest"
  fi
  ln -s "$oc_dest/" "$cc_dest"

  echo -e "  ${GREEN}✅ $skill_name${NC}"
  return 0
}

# === Commands ===

cmd_list() {
  echo -e "${BOLD}${CYAN}OpenClaw Skills 分類：${NC}"
  echo ""
  printf "  ${BOLD}%-18s %-12s %s${NC}\n" "分類 ID" "數量" "說明"
  echo "  ────────────────────────────────────────────────────"
  while IFS='|' read -r id label count desc; do
    printf "  %-18s %-12s %s\n" "$id ($count)" "$label" "$desc"
  done < <(get_categories)
  echo ""
  echo "用法：bash install-skills.sh --category core,memory"
}

cmd_check() {
  echo -e "${BOLD}${CYAN}已安裝 Skills 檢查：${NC}"
  echo ""
  local installed=0
  local missing=0
  while IFS='|' read -r name desc; do
    if [ -d "$OC_SKILLS_DIR/$name" ] || [ -L "$OC_SKILLS_DIR/$name" ]; then
      echo -e "  ${GREEN}✅${NC} $name"
      installed=$((installed + 1))
    else
      echo -e "  ${RED}❌${NC} $name — $desc"
      missing=$((missing + 1))
    fi
  done < <(get_all_skills)
  echo ""
  echo -e "  已安裝: ${GREEN}$installed${NC}  未安裝: ${RED}$missing${NC}"
}

cmd_install_all() {
  echo -e "${BOLD}${CYAN}安裝所有 Skills...${NC}"
  echo ""

  # Ensure target dirs exist
  mkdir -p "$OC_SKILLS_DIR"
  mkdir -p "$CC_SKILLS_DIR"

  local count=0
  local failed=0
  while IFS='|' read -r name desc; do
    if install_skill "$name"; then
      count=$((count + 1))
    else
      failed=$((failed + 1))
    fi
  done < <(get_all_skills)

  echo ""
  echo -e "${GREEN}${BOLD}✅ 安裝完成！${NC} 成功: $count  跳過: $failed"
  post_install
}

cmd_install_categories() {
  local categories="$1"
  echo -e "${BOLD}${CYAN}安裝分類: $categories${NC}"
  echo ""

  mkdir -p "$OC_SKILLS_DIR"
  mkdir -p "$CC_SKILLS_DIR"

  local count=0
  IFS=',' read -ra CATS <<< "$categories"
  for cat in "${CATS[@]}"; do
    cat=$(echo "$cat" | xargs)  # trim
    echo -e "${BOLD}📂 $cat:${NC}"
    while IFS='|' read -r name desc; do
      if install_skill "$name"; then
        count=$((count + 1))
      fi
    done < <(get_skills_in_category "$cat")
    echo ""
  done

  echo -e "${GREEN}${BOLD}✅ 安裝完成！${NC} 共 $count 個 skill"
  post_install
}

cmd_pick() {
  echo -e "${BOLD}${CYAN}互動式 Skill 安裝${NC}"
  echo ""
  echo "每個分類會逐一顯示，你揀 y/n 決定裝唔裝。"
  echo ""

  mkdir -p "$OC_SKILLS_DIR"
  mkdir -p "$CC_SKILLS_DIR"

  local count=0
  while IFS='|' read -r cat_id label cat_count desc; do
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}📂 $label${NC} ($cat_count 個 skill)"
    echo -e "   $desc"
    echo ""

    # Show skills in this category
    while IFS='|' read -r name sdesc; do
      local status=""
      if [ -d "$OC_SKILLS_DIR/$name" ] || [ -L "$OC_SKILLS_DIR/$name" ]; then
        status=" ${GREEN}(已安裝)${NC}"
      fi
      echo -e "   • $name — $sdesc$status"
    done < <(get_skills_in_category "$cat_id")

    echo ""
    read -rp "   安裝呢個分類？(y/n/q) " choice
    case "$choice" in
      y|Y)
        while IFS='|' read -r name sdesc; do
          if install_skill "$name"; then
            count=$((count + 1))
          fi
        done < <(get_skills_in_category "$cat_id")
        ;;
      q|Q)
        echo "中斷安裝。"
        break
        ;;
      *)
        echo "  跳過 $label"
        ;;
    esac
    echo ""
  done < <(get_categories)

  echo ""
  echo -e "${GREEN}${BOLD}✅ 安裝完成！${NC} 共 $count 個 skill"
  post_install
}

post_install() {
  echo ""
  echo -e "${CYAN}後續步驟：${NC}"

  # Check if skill-sync.sh exists
  if [ -f "$HOME/.openclaw/scripts/skill-sync.sh" ]; then
    echo "  1. Skill 已安裝到 OpenClaw workspace + Claude Code (symlink)"
  else
    echo "  1. Skills 已安裝到 $OC_SKILLS_DIR"
    echo "     如果用 Claude Code，建立 symlink："
    echo "     for s in $OC_SKILLS_DIR/*/; do ln -sf \"\$s\" $CC_SKILLS_DIR/\$(basename \$s); done"
  fi

  echo "  2. 重啟 OpenClaw 令 skills 生效：openclaw restart"
}

# === Main ===
case "${1:-}" in
  --all)
    cmd_install_all
    ;;
  --category)
    if [ -z "${2:-}" ]; then
      echo "用法：bash install-skills.sh --category core,memory,workflow"
      echo ""
      cmd_list
      exit 1
    fi
    cmd_install_categories "$2"
    ;;
  --pick)
    cmd_pick
    ;;
  --list)
    cmd_list
    ;;
  --check)
    cmd_check
    ;;
  *)
    echo -e "${BOLD}OpenClaw Skills Installer${NC}"
    echo ""
    echo "用法："
    echo "  bash install-skills.sh --all                   安裝全部 (32 個)"
    echo "  bash install-skills.sh --category core,memory  安裝指定分類"
    echo "  bash install-skills.sh --pick                  互動選擇"
    echo "  bash install-skills.sh --list                  列出所有分類"
    echo "  bash install-skills.sh --check                 檢查已安裝"
    ;;
esac
