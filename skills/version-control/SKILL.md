---
name: version-control
description: Skill versioning, rollback, and safe update management. Use when deploying skills, managing skill versions, rolling back problematic updates, or auditing skill changes.
version: 1.0.0
---

# Version Control for Skills

Manage skill versions, enable safe updates with rollback capability, and track changes across deployments.

## When to Use

- **Deploying new skills** - Version the skill before first deployment
- **Updating existing skills** - Create new version instead of overwriting
- **Rolling back** - Restore previous stable version after problematic update
- **Auditing changes** - Track what changed between versions
- **Safety checks** - Validate changes before applying

## Core Concepts

### Semantic Versioning

Skills follow semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (incompatible API)
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Version Registry

A JSON file tracking all skill versions:

```json
{
  "skills": {
    "tavily-search": {
      "current": "1.2.0",
      "versions": [
        {
          "version": "1.2.0",
          "date": "2025-02-17T12:00:00Z",
          "description": "Added --deep search option",
          "files": ["SKILL.md", "scripts/search.mjs"],
          "hash": "sha256:abc123..."
        }
      ]
    }
  }
}
```

### Version Operations

#### 1. Version a New Skill

```bash
# Create initial version (1.0.0) for a skill
node scripts/version.mjs --skill <skill-name> --action create --version 1.0.0
```

#### 2. Update Existing Skill

```bash
# Increment version and create snapshot
node scripts/version.mjs --skill <skill-name> --action update --type patch|minor|major
```

#### 3. Rollback to Previous Version

```bash
# Rollback to specific version
node scripts/version.mjs --skill <skill-name> --action rollback --version 1.1.0

# Rollback one version
node scripts/version.mjs --skill <skill-name> --action rollback --step 1
```

#### 4. View Version History

```bash
# List all versions for a skill
node scripts/version.mjs --skill <skill-name> --action history

# Show details of specific version
node scripts/version.mjs --skill <skill-name> --action info --version 1.2.0
```

#### 5. Validate Before Deploy

```bash
# Check if version change is safe
node scripts/version.mjs --skill <skill-name> --action validate --version 1.3.0
```

## Scripts

### version.mjs

Main script for all version operations.

```bash
node scripts/version.mjs --skill <skill-name> --action <action> [options]
```

**Actions:**
- `create` - Create initial version
- `update` - Create new version from current
- `rollback` - Restore previous version
- `history` - List version history
- `info` - Show version details
- `validate` - Validate version change

**Options:**
- `--version X.Y.Z` - Specific version number
- `--type patch|minor|major` - Version increment type
- `--step N` - Number of versions to rollback
- `--message "description"` - Version description
- `--dry-run` - Preview without making changes

### snapshot.mjs

Create and restore skill snapshots.

```bash
# Create snapshot
node scripts/snapshot.mjs --skill <skill-name> --action create

# List snapshots
node scripts/snapshot.mjs --skill <skill-name> --action list

# Restore snapshot
node scripts/snapshot.mjs --skill <skill-name> --action restore --snapshot <id>
```

### diff.mjs

Compare versions and show changes.

```bash
# Show diff between versions
node scripts/diff.mjs --skill <skill-name> --from 1.1.0 --to 1.2.0

# Show diff against current
node scripts/diff.mjs --skill <skill-name> --from 1.1.0 --current
```

## Safety Features

### Pre-update Checklist

Before applying any version change:

1. ✅ Run validation (`--action validate`)
2. ✅ Create snapshot (`snapshot.mjs --action create`)
3. ✅ Check diff (`diff.mjs --from current --to new`)
4. ✅ Test in isolated environment
5. ✅ Notify stakeholders if breaking change

### Rollback Triggers

Automatic rollback conditions:
- Validation fails
- Post-deploy health check fails
- Critical error detected

### Backup Strategy

- **Before update**: Automatic snapshot creation
- **Retention**: Keep last 5 snapshots per skill
- **Archive**: Move old snapshots to cold storage after 30 days

## File Structure

```
version-control/
├── SKILL.md (this file)
├── scripts/
│   ├── version.mjs      # Main version management
│   ├── snapshot.mjs     # Snapshot create/restore
│   └── diff.mjs         # Version comparison
└── references/
    └── version-schema.json  # Version registry schema
```

## Integration

### With ClawHub

When publishing to ClawHub:
- Version is automatically extracted from SKILL.md frontmatter
- Changelog generated from version history
- Semantic version enforced

### With CI/CD

```yaml
# Example: Version bump on merge to main
- name: Version and Deploy
  if: github.ref == 'refs/heads/main'
  run: |
    npx clawhub version --update patch --message "Auto-update"
    npx clawhub publish
```

## Best Practices

1. **Always version, never overwrite** - Each change gets a version
2. **Small, frequent updates** - Easier to rollback
3. **Meaningful descriptions** - Explain what changed
4. **Test before publish** - Validate in staging first
5. **Keep snapshots short-term** - Archive old snapshots
6. **Document breaking changes** - Clear migration guide

## Common Workflows

### Bug Fix Release

```bash
# 1. Fix the bug in skill files
# 2. Create patch version
node scripts/version.mjs --skill my-skill --action update --type patch --message "Fix XSS vulnerability"

# 3. Validate
node scripts/version.mjs --skill my-skill --action validate
```

### Feature Release

```bash
# 1. Add new feature
# 2. Create minor version
node scripts/version.mjs --skill my-skill --action update --type minor --message "Add support for OAuth2"

# 3. Validate and publish
node scripts/version.mjs --skill my-skill --action validate
```

### Emergency Rollback

```bash
# 1. Identify problem
# 2. Rollback immediately
node scripts/version.mjs --skill my-skill --action rollback --step 1

# 3. Investigate later
node scripts/snapshot.mjs --skill my-skill --action list
```
