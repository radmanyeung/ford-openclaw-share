#!/usr/bin/env bash
# audit.sh — Skill Auditor CLI
# Usage: bash audit.sh <command> [options]
#
# Commands:
#   full [--json]                Full audit report
#   overlap [--threshold N]      Detect overlapping skills
#   deps [--format text|mermaid] Dependency graph
#   validate [--skill name]      Structural validation
#   usage                        Usage analysis
#   fix                          Auto-fix common issues

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
REFS_DIR="$BASE_DIR/references"
CONFIG_FILE="$REFS_DIR/audit-config.json"
WORKSPACE="${HOME}/.openclaw/workspace"
LOCAL_SKILLS="$WORKSPACE/skills"
BUILTIN_SKILLS="/usr/lib/node_modules/openclaw/skills"

mkdir -p "$REFS_DIR"

[[ -f "$CONFIG_FILE" ]] || cat > "$CONFIG_FILE" <<'EOF'
{
  "overlapThreshold": 0.4,
  "ignoredSkills": [],
  "skillPaths": ["~/.openclaw/workspace/skills", "/usr/lib/node_modules/openclaw/skills"]
}
EOF

CMD="${1:-help}"
shift || true

# Collect all skill directories
collect_skills() {
  local skills=()
  for dir in "$LOCAL_SKILLS"/*/; do
    [[ -f "${dir}SKILL.md" ]] && skills+=("$dir")
  done
  for dir in "$BUILTIN_SKILLS"/*/; do
    [[ -f "${dir}SKILL.md" ]] && skills+=("$dir")
  done
  printf '%s\n' "${skills[@]}"
}

# Extract frontmatter field from SKILL.md
extract_field() {
  local file="$1" field="$2"
  sed -n '/^---$/,/^---$/p' "$file" | grep "^${field}:" | sed "s/^${field}:\s*//" | head -1
}

# Extract description from SKILL.md
extract_description() {
  extract_field "$1" "description"
}

# Word-overlap similarity between two strings (0.0-1.0)
word_similarity() {
  python3 -c "
import sys
a = set('$1'.lower().split())
b = set('$2'.lower().split())
if not a or not b:
    print(0.0)
else:
    print(f'{len(a & b) / len(a | b):.2f}')
" 2>/dev/null || echo "0.00"
}

do_validate() {
  local FILTER="${1:-}"
  local issues=0
  echo "=== Structural Validation ==="
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    local name
    name=$(basename "$dir")
    [[ -n "$FILTER" && "$name" != *"$FILTER"* ]] && continue

    local skill_md="${dir}SKILL.md"
    local sname sdesc
    sname=$(extract_field "$skill_md" "name")
    sdesc=$(extract_field "$skill_md" "description")

    if [[ -z "$sname" ]]; then
      echo "  ❌ $name — missing 'name' in frontmatter"
      issues=$((issues + 1))
    elif [[ -z "$sdesc" ]]; then
      echo "  ❌ $name — missing 'description' in frontmatter"
      issues=$((issues + 1))
    else
      echo "  ✅ $name"
    fi
  done < <(collect_skills)
  echo ""
  echo "Issues found: $issues"
}

do_overlap() {
  local THRESHOLD="${1:-0.40}"
  echo "=== Overlap Detection (threshold: $THRESHOLD) ==="

  # Build array of name:description pairs
  local -a names=()
  local -a descs=()
  local -a paths=()
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    local skill_md="${dir}SKILL.md"
    local n d
    n=$(extract_field "$skill_md" "name")
    d=$(extract_description "$skill_md")
    [[ -n "$n" && -n "$d" ]] || continue
    names+=("$n")
    descs+=("$d")
    paths+=("$dir")
  done < <(collect_skills)

  local count=${#names[@]}
  local found=0
  for ((i=0; i<count; i++)); do
    for ((j=i+1; j<count; j++)); do
      local sim
      sim=$(word_similarity "${descs[$i]}" "${descs[$j]}")
      if python3 -c "exit(0 if float('$sim') >= float('$THRESHOLD') else 1)" 2>/dev/null; then
        echo "  ⚠️  ${names[$i]} ↔ ${names[$j]} (${sim})"
        found=$((found + 1))
      fi
    done
  done

  if [[ $found -eq 0 ]]; then
    echo "  No significant overlaps found."
  fi
  echo ""
  echo "Overlapping pairs: $found"
}

do_deps() {
  local FORMAT="${1:-text}"
  echo "=== Dependency Graph ==="

  if [[ "$FORMAT" == "mermaid" ]]; then
    echo '```mermaid'
    echo 'graph LR'
  fi

  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    local skill_md="${dir}SKILL.md"
    local name
    name=$(extract_field "$skill_md" "name")
    [[ -z "$name" ]] && continue

    # Check replaces: metadata
    local replaces
    replaces=$(sed -n '/^---$/,/^---$/p' "$skill_md" | grep -A20 'replaces:' | grep '^\s*-' | sed 's/^\s*-\s*//' || true)
    for r in $replaces; do
      if [[ "$FORMAT" == "mermaid" ]]; then
        echo "  $name -->|replaces| $r"
      else
        echo "  $name replaces: $r"
      fi
    done

    # Check content references to other skills
    local body
    body=$(sed '1,/^---$/d; 1,/^---$/d' "$skill_md" 2>/dev/null || true)
    while IFS= read -r other_dir; do
      [[ -z "$other_dir" ]] && continue
      local other_name
      other_name=$(basename "$other_dir")
      [[ "$other_name" == "$name" ]] && continue
      if echo "$body" | grep -qi "$other_name" 2>/dev/null; then
        if [[ "$FORMAT" == "mermaid" ]]; then
          echo "  $name -->|references| $other_name"
        else
          echo "  $name references: $other_name"
        fi
      fi
    done < <(collect_skills)
  done < <(collect_skills)

  [[ "$FORMAT" == "mermaid" ]] && echo '```'
  echo ""
}

do_usage() {
  echo "=== Usage Analysis ==="
  local cron_output
  cron_output=$(openclaw cron list 2>/dev/null || echo "")
  local heartbeat=""
  [[ -f "$WORKSPACE/HEARTBEAT.md" ]] && heartbeat=$(cat "$WORKSPACE/HEARTBEAT.md" 2>/dev/null || true)
  local agents=""
  [[ -f "$WORKSPACE/AGENTS.md" ]] && agents=$(cat "$WORKSPACE/AGENTS.md" 2>/dev/null || true)
  local soul=""
  [[ -f "$WORKSPACE/SOUL.md" ]] && soul=$(cat "$WORKSPACE/SOUL.md" 2>/dev/null || true)

  local ALL_REFS="$cron_output $heartbeat $agents $soul"
  # Also check cross-references from other skills
  local ALL_SKILL_CONTENT=""
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    ALL_SKILL_CONTENT+=" $(cat "${dir}SKILL.md" 2>/dev/null || true)"
  done < <(collect_skills)

  local unused=0
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    local name
    name=$(basename "$dir")
    local sname
    sname=$(extract_field "${dir}SKILL.md" "name")
    [[ -z "$sname" ]] && sname="$name"

    # Check if referenced in any config or other skill
    if echo "$ALL_REFS" | grep -qi "$sname" 2>/dev/null; then
      echo "  ✅ $sname — referenced"
    elif echo "$ALL_SKILL_CONTENT" | grep -c "$sname" 2>/dev/null | grep -qv '^[01]$' 2>/dev/null; then
      echo "  ✅ $sname — cross-referenced by other skills"
    else
      echo "  🔇 $sname — no references found"
      unused=$((unused + 1))
    fi
  done < <(collect_skills)

  echo ""
  echo "Potentially unused: $unused"
}

case "$CMD" in
  full)
    JSON=false
    [[ "${1:-}" == "--json" ]] && JSON=true
    NOW=$(TZ=Asia/Hong_Kong date '+%Y-%m-%d %H:%M %Z')
    TOTAL=$(collect_skills | wc -l)
    LOCAL=$(find "$LOCAL_SKILLS" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l)
    BUILTIN=$(find "$BUILTIN_SKILLS" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l)

    echo "=== Skill Audit Report ($NOW) ==="
    echo "📂 Skills scanned: $TOTAL ($LOCAL local + $BUILTIN builtin)"
    echo ""
    do_validate
    echo ""
    do_overlap
    echo ""
    do_deps
    echo ""
    do_usage
    ;;
  overlap)
    THRESHOLD="0.40"
    [[ "${1:-}" == "--threshold" ]] && THRESHOLD="${2:-0.40}"
    do_overlap "$THRESHOLD"
    ;;
  deps)
    FORMAT="text"
    [[ "${1:-}" == "--format" ]] && FORMAT="${2:-text}"
    do_deps "$FORMAT"
    ;;
  validate)
    SKILL_FILTER=""
    [[ "${1:-}" == "--skill" ]] && SKILL_FILTER="${2:-}"
    do_validate "$SKILL_FILTER"
    ;;
  usage)
    do_usage
    ;;
  help|*)
    cat <<'HELP'
audit.sh — Skill Auditor

Commands:
  full [--json]                Full audit report
  overlap [--threshold N]      Detect overlapping skills
  deps [--format text|mermaid] Dependency graph
  validate [--skill name]      Structural validation
  usage                        Usage analysis
  fix                          Auto-fix common issues
HELP
    ;;
  fix)
    echo "=== Auto-Fix Skill Issues ==="
    echo ""
    local FIXED=0
    
    # Fix 1: Add missing frontmatter to SKILL.md
    while IFS= read -r dir; do
      [[ -z "$dir" ]] && continue
      local name
      name=$(basename "$dir")
      local skill_md="${dir}SKILL.md"
      
      # Check if frontmatter exists
      if ! head -1 "$skill_md" | grep -q "^---"; then
        echo "🔧 Adding frontmatter to: $name"
        # Extract description from first paragraph
        local desc
        desc=$(sed -n '/^---$/,/^---$/p' "$skill_md" | grep "^description:" | sed 's/^description:\s*//' | head -1)
        [[ -z "$desc" ]] && desc="Auto-generated skill"
        
        # Prepend frontmatter
        local temp_file
        temp_file=$(mktemp)
        cat > "$temp_file" <<EOF
---
name: $name
description: $desc
version: 1.0.0
---

EOF
        cat "$skill_md" >> "$temp_file"
        mv "$temp_file" "$skill_md"
        FIXED=$((FIXED + 1))
      fi
    done < <(collect_skills)
    
    echo ""
    echo "✅ Fixed $FIXED issue(s)"
    ;;
esac
