---
name: skill-registry
description: Centralized skill discovery and registry management. Use when listing available skills, searching skills by capability, or managing skill metadata.
version: 1.0.0
---

# Skill Registry & Discovery System

Centralized management for discovering, searching, and querying available skills.

## When to Use

- List all installed skills
- Search skills by name, tag, or capability
- Get skill metadata (version, author, dependencies)
- Filter skills by category or functionality

## Usage

```bash
# List all skills
node scripts/list.mjs

# Search skills
node scripts/search.mjs "context"

# Get skill details
node scripts/info.mjs <skill-name>

# Add/remove skills from registry
node scripts/register.mjs <skill-name>

# Build global registry from all skills
node scripts/build-registry.mjs
```

## Registry Structure

The global registry (`skills-registry.json`) stores:

```json
{
  "skills": {
    "skill-name": {
      "name": "skill-name",
      "description": "...",
      "version": "1.0.0",
      "tags": ["tag1", "tag2"],
      "author": "...",
      "created": "2026-02-17",
      "path": "/path/to/skill"
    }
  },
  "tags": {
    "tag1": ["skill-a", "skill-b"],
    "tag2": ["skill-c"]
  }
}
```
