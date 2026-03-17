---
name: schema-validator
description: Automatically validate and auto-fix JSON/YAML schema files including memory files, script configurations, and structured data. Detects errors and suggests or applies corrections.
version: 1.0.0
---

# Schema Validator & Auto-Fixer

Validate and auto-fix JSON/YAML schema files to prevent memory corruption and configuration errors.

## When to Use

- Before committing memory files (memory/*.md with JSON frontmatter)
- Validating OpenClaw config files (openclaw.json, gateway settings)
- Checking script configurations and dependency files
- Debugging "invalid JSON" or "parse error" issues
- Batch validation of all structured files in workspace

## Core Functions

### 1. Validation Modes

- **check-only**: Scan and report errors without modifying
- **auto-fix**: Automatically correct common errors
- **strict-mode**: Fail on warnings (not just errors)

### 2. Auto-Fixable Errors

- Trailing commas in JSON
- Missing quotes on keys
- Duplicate keys (keeps last value)
- Tab/space indentation issues in YAML
- Common YAML syntax errors

### 3. Supported Schemas

- JSON files (*.json)
- YAML files (*.yaml, *.yml)
- Markdown with JSON frontmatter (memory/*.md)
- OpenClaw config schemas
- Skill dependency files (dependencies.json)
- Package.json files

## Usage

```bash
# Validate a single file
node scripts/validate.mjs <file-path>

# Auto-fix a file
node scripts/validate.mjs <file-path> --fix

# Batch validate directory
node scripts/validate.mjs --dir <directory> --fix

# Check all memory files
node scripts/validate.mjs --dir memory/ --fix

# Verbose output with schema info
node scripts/validate.mjs <file-path> --verbose
```

## Integration Points

### With Memory System
```bash
# Pre-commit hook simulation
node scripts/validate.mjs --dir memory/ --fix
```

### With OpenClaw Gateway
```bash
# Validate gateway config
node scripts/validate.mjs /etc/openclaw/openclaw.json --fix
```

## Error Output Format

```json
{
  "file": "memory/2026-02-15.md",
  "valid": false,
  "errors": [
    {
      "line": 42,
      "column": 5,
      "code": "TRAILING_COMMA",
      "message": "Trailing comma in JSON object",
      "fix": "Remove trailing comma"
    }
  ],
  "warnings": [],
  "fixed": true
}
```

## Exit Codes

- `0`: All files valid
- `1`: Validation errors found (check-only)
- `2`: Fatal error (file not found, permission denied)
