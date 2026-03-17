#!/usr/bin/env bash
# tracker.sh — Research Tracker CLI
# Usage: bash tracker.sh <command> [options]
#
# Commands:
#   scan [--days N]              Scan research files for findings
#   status                       Show findings status summary
#   mark --finding "text" --status adopted|rejected|pending --reason "..."
#   hypothesis --text "..." --status unverified|verified|falsified|inconclusive
#   report [--days N] [--json]   Adoption rate report
#   prune --older-than Nd        Remove old entries

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
REFS_DIR="$BASE_DIR/references"
DB_FILE="$REFS_DIR/tracking-db.json"
WORKSPACE="${HOME}/.openclaw/workspace"
RESEARCH_DIR="$WORKSPACE/research"

mkdir -p "$REFS_DIR"

# Init DB if missing
[[ -f "$DB_FILE" ]] || cat > "$DB_FILE" <<'EOF'
{
  "findings": [],
  "hypotheses": []
}
EOF

CMD="${1:-help}"
shift || true

# Generate unique ID
gen_id() {
  date +%Y%m%d-%H%M%S-$(head -c4 /dev/urandom | xxd -p)
}

do_scan() {
  local DAYS="${1:-7}"
  local SINCE=$(date -d "$DAYS days ago" +%Y-%m-%d)
  echo "=== Scanning Research Files (since $SINCE) ==="
  local count=0

  for f in "$RESEARCH_DIR"/daily-research-*.md; do
    [[ -f "$f" ]] || continue
    local fname=$(basename "$f")
    local fdate="${fname#daily-research-}"
    fdate="${fdate%.md}"
    [[ "$fdate" < "$SINCE" ]] && continue

    echo "--- $fdate ---"
    # Extract findings (bullet points)
    grep -E '^\s*[-*]\s' "$f" 2>/dev/null | while read -r line; do
      # Clean markdown formatting
      line=$(echo "$line" | sed 's/^\s*[-*]\s*//' | sed 's/\[.*\]//g' | xargs)
      [[ -n "$line" ]] && echo "  • $line" && count=$((count + 1))
    done
  done

  echo ""
  echo "Found $count finding(s) in the last $DAYS day(s)."
}

do_status() {
  echo "=== Research Findings Status ==="
  python3 -c "
import json
db = json.load(open('$DB_FILE'))
findings = db.get('findings', [])
total = len(findings)
adopted = sum(1 for f in findings if f.get('status') == 'adopted')
rejected = sum(1 for f in findings if f.get('status') == 'rejected')
pending = sum(1 for f in findings if f.get('status') == 'pending')
print(f'📊 Total: {total} | ✅ Adopted: {adopted} | ❌ Rejected: {rejected} | ⏳ Pending: {pending}')
if total > 0:
    adoption_rate = (adopted / total) * 100
    print(f'   Adoption Rate: {adoption_rate:.1f}%')
" 2>/dev/null

  echo ""
  echo "Recent:"
  python3 -c "
import json
from datetime import datetime
db = json.load(open('$DB_FILE'))
for f in sorted(db.get('findings', []), key=lambda x: x.get('decidedAt', x.get('date','')), reverse=True)[:10]:
    status_icon = {'adopted':'✅','rejected':'❌','pending':'⏳','deferred':'⏸'}.get(f.get('status'), '?')
    print(f'  [{f.get(\"date\",\"?\")}] {status_icon} {f.get(\"text\",\"?\")[:50]}')
" 2>/dev/null || echo "  No findings tracked yet."
}

do_mark() {
  local FINDING="" STATUS="" REASON=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --finding) FINDING="$2"; shift 2 ;;
      --status) STATUS="$2"; shift 2 ;;
      --reason) REASON="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$FINDING" || -z "$STATUS" ]]; then
    echo "Usage: tracker.sh mark --finding '...' --status adopted|rejected|pending --reason '...'"
    exit 1
  fi

  python3 <<PYEOF
import json
from datetime import datetime
db = json.load(open('$DB_FILE'))
found = False
for f in db.get('findings', []):
    if FINDING.lower() in f.get('text', '').lower():
        f['status'] = '$STATUS'
        f['reason'] = '$REASON'
        f['decidedAt'] = datetime.utcnow().isoformat() + 'Z'
        found = True
        print(f"Updated: {f['date']} | {f['text'][:40]}... → $STATUS")
if not found:
    # Add new finding
    new_id = 'f-' + datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    new_f = {
        'id': new_id,
        'date': datetime.now().strftime('%Y-%m-%d'),
        'text': '$FINDING',
        'status': '$STATUS',
        'reason': '$REASON',
        'decidedAt': datetime.utcnow().isoformat() + 'Z'
    }
    db['findings'].append(new_f)
    print(f"New finding marked: $STATUS")
json.dump(db, open('$DB_FILE', 'w'), indent=2)
PYEOF
}

do_hypothesis() {
  local TEXT="" STATUS="" EVIDENCE=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --text) TEXT="$2"; shift 2 ;;
      --status) STATUS="$2"; shift 2 ;;
      --evidence) EVIDENCE="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$TEXT" || -z "$STATUS" ]]; then
    echo "Usage: tracker.sh hypothesis --text '...' --status unverified|verified|falsified|inconclusive"
    exit 1
  fi

  python3 <<PYEOF
import json
from datetime import datetime
db = json.load(open('$DB_FILE'))
found = False
for h in db.get('hypotheses', []):
    if TEXT.lower() in h.get('text', '').lower():
        h['status'] = '$STATUS'
        h['evidence'] = '$EVIDENCE'
        if '$STATUS' in ('verified', 'falsified'):
            h['verifiedAt'] = datetime.utcnow().isoformat() + 'Z'
        found = True
        print(f"Hypothesis updated: {h['text'][:40]}... → $STATUS")
if not found:
    new_id = 'h-' + datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    new_h = {
        'id': new_id,
        'text': '$TEXT',
        'status': '$STATUS',
        'evidence': '$EVIDENCE',
        'createdAt': datetime.utcnow().isoformat() + 'Z'
    }
    if '$STATUS' in ('verified', 'falsified'):
        new_h['verifiedAt'] = datetime.utcnow().isoformat() + 'Z'
    db['hypotheses'].append(new_h)
    print(f"New hypothesis added: $STATUS")
json.dump(db, open('$DB_FILE', 'w'), indent=2)
PYEOF
}

do_report() {
  local DAYS="${1:-30}"
  local JSON=false
  [[ "${2:-}" == "--json" ]] && JSON=true

  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  python3 <<PYEOF
import json
from datetime import datetime, timedelta
db = json.load(open('$DB_FILE'))
findings = db.get('findings', [])
hypotheses = db.get('hypotheses', [])

# Filter by days
cutoff = (datetime.utcnow() - timedelta(days=int('$DAYS'))).isoformat()
recent_findings = [f for f in findings if f.get('date','') >= cutoff]

total = len(recent_findings)
adopted = sum(1 for f in recent_findings if f.get('status') == 'adopted')
rejected = sum(1 for f in recent_findings if f.get('status') == 'rejected')
pending = sum(1 for f in recent_findings if f.get('status') == 'pending')
adoption_rate = (adopted / total * 100) if total > 0 else 0

verified = sum(1 for h in hypotheses if h.get('status') == 'verified')
falsified = sum(1 for h in hypotheses if h.get('status') == 'falsified')
unverified = sum(1 for h in hypotheses if h.get('status') == 'unverified')

if $JSON:
    import json as j
    out = {
        "periodDays": int('$DAYS'),
        "timestamp": '$NOW',
        "findings": {
            "total": total,
            "adopted": adopted,
            "rejected": rejected,
            "pending": pending,
            "adoptionRate": round(adoption_rate, 1)
        },
        "hypotheses": {
            "verified": verified,
            "falsified": falsified,
            "unverified": unverified
        }
    }
    print(j.dumps(out, indent=2))
else:
    print("=== Research Adoption Report (last $DAYS days) ===")
    print(f"Generated: $NOW")
    print("")
    print("📊 Findings")
    print(f"   Total: {total} | ✅ {adopted} | ❌ {rejected} | ⏳ {pending}")
    print(f"   Adoption Rate: {adoption_rate:.1f}%")
    print("")
    print("🧪 Hypotheses")
    print(f"   Verified: {verified} | Falsified: {falsified} | Unverified: {unverified}")
    print("")
    if pending > 0:
        print("⚠️  Pending Findings (>7 days):")
        for f in recent_findings:
            if f.get('status') == 'pending':
                age = (datetime.utcnow() - datetime.fromisoformat(f.get('date'))).days
                if age > 7:
                    print(f"   • [{f.get('date')}] {f.get('text','')[:50]}...")
PYEOF
}

case "$CMD" in
  scan)
    do_scan "${1:-7}"
    ;;
  status)
    do_status
    ;;
  mark)
    shift
    do_mark "$@"
    ;;
  hypothesis)
    shift
    do_hypothesis "$@"
    ;;
  report)
    DAYS="${1:-30}"
    do_report "$DAYS" "${2:-}"
    ;;
  prune)
    DAYS="${1:-90}"
    python3 <<PYEOF
import json
from datetime import datetime, timedelta
db = json.load(open('$DB_FILE'))
cutoff = (datetime.utcnow() - timedelta(days=int('$DAYS'))).strftime('%Y-%m-%d')
orig = len(db.get('findings', []))
db['findings'] = [f for f in db.get('findings', []) if f.get('date','') > cutoff]
pruned = orig - len(db.get('findings', []))
json.dump(db, open('$DB_FILE', 'w'), indent=2)
print(f"Pruned {pruned} findings older than $DAYS days.")
PYEOF
    ;;
  export)
    # Export tracking DB to a backup file
    EXPORT_FILE="${1:-tracking-db-export-$(date +%Y%m%d).json}"
    if [[ -f "$DB_FILE" ]]; then
      cp "$DB_FILE" "$EXPORT_FILE"
      echo "✅ Exported to: $EXPORT_FILE"
    else
      echo "❌ No tracking DB found at $DB_FILE"
    fi
    ;;
  import)
    # Import tracking DB from a backup file
    IMPORT_FILE="${1:-}"
    if [[ -z "$IMPORT_FILE" ]]; then
      echo "Usage: tracker.sh import <file.json>"
      exit 1
    fi
    if [[ -f "$IMPORT_FILE" ]]; then
      cp "$DB_FILE" "${DB_FILE}.bak" 2>/dev/null || true
      cp "$IMPORT_FILE" "$DB_FILE"
      echo "✅ Imported from: $IMPORT_FILE (backup: ${DB_FILE}.bak)"
    else
      echo "❌ File not found: $IMPORT_FILE"
    fi
    ;;
  help|*)
    cat <<'HELP'
tracker.sh — Research Tracker

Commands:
  scan [--days N]              Scan research files for findings
  status                       Show findings status summary
  mark --finding "..." --status adopted|rejected|pending --reason "..."
  hypothesis --text "..." --status unverified|verified|falsified|inconclusive
  report [--days N] [--json]   Adoption rate report
  prune --older-than Nd        Remove old entries
  export [filename]             Export tracking DB to backup file
  import <file.json>           Import tracking DB from backup
HELP
    ;;
esac
