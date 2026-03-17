---
name: skill-auditor
description: Audit installed skills for dependency conflicts, overlapping functionality, unused skills, and structural issues. Generates actionable audit reports.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added auto-fix command to repair missing frontmatter"
---

# Skill Auditor

Scans all installed skills and produces an audit report covering dependency health, functional overlap detection, structural validation, and usage analysis.

## When to Use

- Periodic skill ecosystem health check
- Before/after installing new skills
- Identifying redundant or conflicting skills
- Cleaning up unused skills

## Quick Reference

```bash
BASE="~/.openclaw/workspace/skills/skill-auditor/scripts"

# Full audit (all checks)
bash $BASE/audit.sh full

# Overlap detection only
bash $BASE/audit.sh overlap

# Dependency graph
bash $BASE/audit.sh deps

# Structural validation
bash $BASE/audit.sh validate

# Usage analysis (checks if skill is referenced in configs/crons)
bash $BASE/audit.sh usage

# JSON output
bash $BASE/audit.sh full --json

# Audit specific skill
bash $BASE/audit.sh validate --skill context-manager
```

## Architecture

```
skill-auditor/
├── SKILL.md
├── scripts/
│   └── audit.sh              # Main audit CLI
└── references/
    └── audit-config.json     # Overlap threshold, ignore list
```

## Commands

### full

Run all audit checks and produce a combined report.

```bash
bash audit.sh full [--json]
```

Checks performed:
1. **Structural validation** — SKILL.md exists, frontmatter has name+description
2. **Dependency analysis** — skills referencing other skills
3. **Overlap detection** — description similarity scoring
4. **Usage analysis** — cross-reference with cron jobs, HEARTBEAT.md, AGENTS.md

### overlap

Detect skills with similar descriptions (potential duplicates).

```bash
bash audit.sh overlap [--threshold 0.5]
```

Uses word-overlap scoring between skill descriptions. Pairs above threshold are flagged.

### deps

Build and display a dependency graph.

```bash
bash audit.sh deps [--format text|mermaid]
```

Detects:
- `replaces:` metadata in frontmatter
- Cross-references in SKILL.md content (mentions of other skill names)

### validate

Check structural correctness of all skills.

```bash
bash audit.sh validate [--skill name]
```

Checks:
- SKILL.md exists and has YAML frontmatter
- `name` and `description` fields present
- scripts/ directory exists if referenced
- No broken internal references

### usage

Check whether skills are actively referenced.

```bash
bash audit.sh usage
```

Cross-references skills against:
- `openclaw cron list` output
- HEARTBEAT.md
- AGENTS.md / SOUL.md
- Other skills' SKILL.md content

### fix

Auto-fix common structural issues.

```bash
bash audit.sh fix
```

Currently fixes:
- ✅ Missing YAML frontmatter (adds basic frontmatter with name + extracted description)

## Configuration

`references/audit-config.json`:

```json
{
  "overlapThreshold": 0.4,
  "ignoredSkills": [],
  "skillPaths": [
    "~/.openclaw/workspace/skills",
    "/usr/lib/node_modules/openclaw/skills"
  ]
}
```

## Output Example

```
=== Skill Audit Report (2026-02-26) ===

📂 Skills scanned: 25 (20 local + 5 builtin)

✅ Structural Validation
   All 25 skills have valid SKILL.md with name + description

⚠️ Overlapping Skills (similarity > 40%)
   context-aware-memory-manager ↔ context-manager (72%) — consider removing deprecated version
   skill-dependency-manager ↔ task-dependency-graph (55%)
   tavily-research-agent ↔ tavily-research-orchestrator (63%)

📊 Dependency Graph
   context-manager replaces: context-aware-memory, context-compression-manager, context-memory-archivist
   skill-dependency-manager → dependency-graph-viz (references)

🔇 Potentially Unused Skills (no references found)
   cross-session-context-bridge
   workflow-template-library

📋 Summary: 2 overlaps flagged, 2 unused skills, 0 structural issues
```

## Best Practices

1. **Run monthly** or after skill ecosystem changes
2. **Act on overlaps** — merge or document why both exist
3. **Clean unused skills** — reduce cognitive and token overhead
4. **Update replaces: metadata** when consolidating skills
