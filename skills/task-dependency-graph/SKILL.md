---
name: task-dependency-graph
description: Track and visualize dependencies between skills to prevent cascading failures during updates. Supports dependency graphs, version management, and rollback capabilities.
version: 1.0.0
---

# Task Dependency Graph Manager

Track, visualize, and manage skill dependencies with graph-based analysis to prevent cascading failures during updates.

## When to Use

- Before updating any skill to check dependent skills
- When installing a new skill to identify prerequisites
- To detect circular dependencies in skill network
- For planning safe update order across multiple skills
- When rolling back a skill to identify affected dependents

## Core Concepts

### Dependency Types

| Type | Description | Impact |
|------|-------------|--------|
| **Hard** | Skill cannot function | Block operation if missing |
| **Soft** | Reduced functionality | Warn but allow operation |
| **Optional** | Extended features only | Silent if missing |

### Dependency Resolution

When multiple skills share a transitive dependency:
- Uses highest version requested
- Marks version conflicts
- Warns about circular dependencies

## Usage

```bash
# Check dependencies for a skill
node scripts/graph.mjs check <skill-name>

# Show full dependency tree
node scripts/graph.mjs tree

# Visualize as ASCII graph
node scripts/graph.mjs visual

# Find all skills depending on X
node scripts/graph.mjs dependents <skill-name>

# Validate no circular dependencies
node scripts/graph.mjs validate

# Plan safe update order
node scripts/graph.mjs plan --update
```

## Graph Format

Skills declare dependencies in `dependencies.json`:

```json
{
  "skill-name": {
    "version": "1.0.0",
    "dependencies": {
      "hard": ["skill-a@>=2.0", "skill-b"],
      "soft": ["skill-c"],
      "optional": ["skill-d"]
    }
  }
}
```

## Visualization Output

```
Context-Aware Memory Manager
├── skill-registry (hard)
│   └── skill-creator (soft)
├── context-compression (hard)
└── Tavily Research Agent (optional)
```

## Error Handling

- **Circular Dependency**: Blocks execution, requires manual fix
- **Missing Dependency**: Prompts installation
- **Version Conflict**: Shows conflicting requirements
