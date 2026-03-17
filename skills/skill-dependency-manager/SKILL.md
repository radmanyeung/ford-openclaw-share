---
name: skill-dependency-manager
description: Track and manage skill dependencies. Use when skills reference each other, when checking if dependencies are installed, or when building skill graphs for execution planning.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added auto-detect command to scan SKILL.md for dependencies"
---

# Skill Dependency Manager

This skill tracks dependencies between skills and provides validation and resolution capabilities.

## When to Use

- When one skill depends on another
- Before installing/activating a skill to check prerequisites
- When building execution plans that need skill ordering
- For detecting circular dependencies or missing dependencies

## Core Concepts

### Dependency Types

1. **Hard Dependency**: Skill cannot function without the dependency
2. **Soft Dependency**: Skill works but with reduced functionality
3. **Optional Dependency**: Skill may use the dependency for extended features

### Dependency Resolution

When multiple skills depend on the same transitive dependency, the resolver:
- Uses the highest version requested
- Marks conflicts if incompatible versions are required
- Warns about circular dependencies

## Usage

```bash
# Check if all dependencies are met
node scripts/check-deps.mjs <skill-name>

# List all skills and their dependencies
node scripts/list-deps.mjs

# Resolve and install dependencies
node scripts/resolve-deps.mjs <skill-name>

# Validate no circular dependencies
node scripts/validate-graph.mjs

# Auto-detect dependencies from SKILL.md references
node scripts/auto-detect-deps.mjs

# Auto-detect and write to dependencies.json
node scripts/auto-detect-deps.mjs --write
```

## Dependency File Format

Skills declare dependencies in `dependencies.json`:

```json
{
  "skill-dependency-manager": {
    "version": "1.0.0",
    "dependencies": {
      "hard": ["skill-a", "skill-b"],
      "soft": ["skill-c"],
      "optional": ["skill-d"]
    }
  }
}
```
