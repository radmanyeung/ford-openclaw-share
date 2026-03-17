---
name: json-yaml-validator
description: Automatic validation and auto-fix for JSON/YAML files. Detects syntax errors, structural issues, and attempts automatic corrections. Use when validating memory files, config files, scripts, or any JSON/YAML data structure to prevent corruption and ensure structural integrity.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added YAML auto-fix support (tabs, quotes, trailing commas)"
---

# JSON/YAML Validator & Auto-Fixer

Automated validation and repair for JSON/YAML files in the workspace.

## When to Use

- **Config file validation**: Validate `openclaw.json`, scripts, or any configuration
- **Skill files**: Validate YAML frontmatter in `SKILL.md` files
- **Syntax error detection**: Identify trailing commas, missing quotes, indentation issues
- **Auto-fix mode**: Automatically repair common JSON errors
- **Batch validation**: Scan entire directories for structural issues
- **CI/CD integration**: Pre-commit hooks for JSON/YAML integrity checks

## Usage

```bash
# Validate a single file
python3 skills/json-yaml-validator/scripts/validator.py path/to/file.json

# Auto-fix common errors
python3 skills/json-yaml-validator/scripts/validator.py path/to/file.json --fix

# Validate entire directory (recursive)
python3 skills/json-yaml-validator/scripts/validator.py memory/ --recursive --fix

# Output as JSON for programmatic use
python3 skills/json-yaml-validator/scripts/validator.py path/to/file.json --output json

# Custom file pattern
python3 skills/json-yaml-validator/scripts/validator.py path/to/dir -p "*.jsonl"
```

## Auto-Fix Capabilities

The validator automatically fixes:
- ✅ Trailing commas in arrays/objects (JSON)
- ✅ Missing quotes on keys (JSON)
- ✅ Single quotes converted to double quotes (JSON)
- ✅ Tab characters → spaces (YAML)
- ✅ Single quotes → double quotes (YAML)
- ✅ Trailing commas removed (YAML)
- ✅ Unquoted keys with special characters (YAML)

### Example

Common errors that get auto-fixed:
- Single quotes → double quotes
- Unquoted keys → quoted keys  
- Trailing commas → removed
- Tabs → 2 spaces (YAML)

The validator will report these issues and can automatically repair them with `--fix`.

## Examples

### Validation Report

```
============================================================
Validation Report
============================================================
Total files: 3
Valid:       2
Invalid:     1
Auto-fixed:  1
============================================================

✅ memory/context-summary.md
   Format: JSON
   Size:   1234 bytes

✅ skills/skill-registry/SKILL.md
   Format: YAML
   Size:   5678 bytes

🔧 memory/2026-02-18.md
   Format: JSON
   Size:   890 bytes
   [AUTO-FIXED]
```

### Integration with Workflows

```bash
# Add to pre-commit or automated checks
#!/bin/bash
python3 skills/json-yaml-validator/scripts/validator.py memory/ --recursive --fix || {
    echo "Validation failed after auto-fix"
    exit 1
}
```

## Supported Formats

| Format | Extensions | Auto-Fix |
|--------|------------|----------|
| JSON | `.json`, `.jsonl` | ✅ Yes |
| YAML | `.yaml`, `.yml` | ❌ No (validation only) |
| Markdown | `.md`, `.markdown` | ⚠️ Frontmatter only |

**Markdown support:** Validates YAML frontmatter (`---` blocks) and embedded JSON/YAML code blocks.

## Exit Codes

- `0`: All files valid (or all fixed)
- `1`: One or more files remain invalid after validation

## Recommendations

- Run validator after any memory file edit
- Use `--fix` mode for automatic repair of common issues
- Use `--output json` for integration with other tools
- Validate entire `memory/` directory weekly
