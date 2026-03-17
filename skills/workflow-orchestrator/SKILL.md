---
name: workflow-orchestrator
description: Cross-platform task orchestration with dependencies, parallel execution, and retry logic. Use when coordinating multi-step workflows, parallelizing independent tasks, or implementing error recovery.
version: 1.2.0
metadata:
  changes:
    - "1.1.0: Added dashboard.html for visual monitoring"
    - "1.2.0: Added schedule command for cron-like recurring workflows"
---

# Workflow Orchestrator

Cross-platform task orchestration with dependency management, parallel execution, and retry logic.

## When to Activate

Activate this skill when:
- Multi-step workflows with dependencies
- Parallelizing independent tasks
- Implementing retry/error recovery
- Coordinating sub-agents
- Long-running automated processes

## Core Concepts

### Workflow Graph

```
┌─────────────┐     ┌─────────────┐
│   Start     │────▶│   Step A    │
└─────────────┘     └─────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐
     │ Step B  │   │ Step C  │   │ Step D  │
     └─────────┘   └─────────┘   └─────────┘
           │              │              │
           └──────────────┼──────────────┘
                          ▼
                   ┌─────────────┐
                   │   Finish    │
                   └─────────────┘
```

### Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `sequential` | Run steps in order | Dependent tasks |
| `parallel` | Run independent steps | Multiple APIs |
| `conditional` | Run based on conditions | Error recovery |
| `retry` | Re-run failed steps | Transient failures |

### Task States

```
Pending → Running → Completed | Failed
                ↓              ↓
           Blocked        Retrying (max 3)
```

## Usage

### Execute Workflow

```bash
# Run a workflow from file
node scripts/orchestrator.mjs --action execute --workflow my-workflow.json

# Dry run (preview only)
node scripts/orchestrator.mjs --action execute --workflow my-workflow.json --dry-run
```

### List Workflows

```bash
# List available workflows
node scripts/orchestrator.mjs --action list

# Show workflow details
node scripts/orchestrator.mjs --action show --workflow my-workflow.json
```

### Check Status

```bash
# Check running workflow status
node scripts/orchestrator.mjs --action status --run-id <id>
```

### Retry Failed

```bash
# Retry failed steps
node scripts/orchestrator.mjs --action retry --run-id <id>
```

### Cancel Running

```bash
# Cancel running workflow
node scripts/orchestrator.mjs --action cancel --run-id <id>
```

## Scripts

### orchestrator.mjs

Main orchestrator script.

```bash
node scripts/orchestrator.mjs --action <action> [options]
```

**Actions:**
- `execute` - Run a workflow
- `list` - List available workflows
- `show` - Show workflow details
- `status` - Check execution status
- `retry` - Retry failed steps
- `cancel` - Cancel running workflow
- `create` - Create new workflow

**Options:**
- `--workflow <name>` - Workflow file name
- `--run-id <id>` - Execution run ID
- `--dry-run` - Preview without execution
- `--verbose, -v` - Detailed output

## Workflow Definition

### Basic Workflow

```json
{
  "name": "example-workflow",
  "description": "Example workflow with parallel steps",
  "steps": [
    {
      "id": "setup",
      "name": "Setup Environment",
      "type": "shell",
      "command": "npm install",
      "timeout": 120
    },
    {
      "id": "test",
      "name": "Run Tests",
      "type": "shell",
      "command": "npm test",
      "dependsOn": ["setup"],
      "retry": 3,
      "retryDelay": 5
    }
  ]
}
```

### Parallel Workflow

```json
{
  "name": "parallel-example",
  "description": "Parallel task execution",
  "steps": [
    {
      "id": "fetch-users",
      "name": "Fetch Users",
      "type": "agent",
      "agent": "sessions_spawn",
      "params": { "task": "Fetch user list" },
      "output": "users"
    },
    {
      "id": "fetch-posts",
      "name": "Fetch Posts",
      "type": "agent",
      "agent": "sessions_spawn",
      "params": { "task": "Fetch post list" },
      "output": "posts"
    },
    {
      "id": "aggregate",
      "name": "Aggregate Results",
      "type": "shell",
      "command": "echo \"Users: $USERS, Posts: $POSTS\"",
      "dependsOn": ["fetch-users", "fetch-posts"],
      "env": {
        "USERS": "${steps.fetch-users.output}",
        "POSTS": "${steps.fetch-posts.output}"
      }
    }
  ]
}
```

### Conditional Workflow

```json
{
  "name": "conditional-example",
  "description": "Run based on conditions",
  "steps": [
    {
      "id": "deploy",
      "name": "Deploy to Production",
      "type": "shell",
      "command": "deploy.sh production",
      "condition": "${env.NODE_ENV === 'production'}"
    },
    {
      "id": "deploy-staging",
      "name": "Deploy to Staging",
      "type": "shell",
      "command": "deploy.sh staging",
      "condition": "${env.NODE_ENV !== 'production'}"
    }
  ]
}
```

## File Structure

```
workflow-orchestrator/
├── SKILL.md (this file)
├── scripts/
│   └── orchestrator.mjs      # Main orchestrator
├── workflows/                # Workflow definitions
│   └── example.json
├── runs/                     # Execution history
│   └── (auto-created)
└── logs/                     # Execution logs
    └── (auto-created)
```

## Integration

### With Sub-Agents

```json
{
  "steps": [
    {
      "id": "research",
      "name": "Research Phase",
      "type": "agent",
      "agent": "sessions_spawn",
      "model": "qwen",
      "params": {
        "task": "Research the topic and return findings"
      },
      "timeout": 300
    },
    {
      "id": "implement",
      "name": "Implementation Phase",
      "type": "agent",
      "agent": "sessions_spawn",
      "dependsOn": ["research"],
      "params": {
        "task": "Based on research: ${steps.research.output}"
      }
    }
  ]
}
```

### With Context Manager

Integrate with `context-aware-memory` for long workflows:

```json
{
  "name": "long-workflow",
  "context": {
    "enabled": true,
    "summaryFile": "memory/context-summary.md"
  },
  "steps": [...]
}
```

## Best Practices

1. **Keep steps small**: Each step should do one thing
2. **Define dependencies**: Explicitly state dependencies
3. **Set timeouts**: Prevent hanging steps
4. **Add retries**: Handle transient failures
5. **Use parallel**: Run independent tasks together
6. **Log everything**: Track execution for debugging
7. **Test workflows**: Run with --dry-run first

## Common Workflows

### Code Review Workflow

```bash
node scripts/orchestrator.mjs --action execute \
  --workflow code-review.json \
  --verbose
```

### Research + Implementation

```bash
node scripts/orchestrator.mjs --action execute \
  --workflow research-implement.json \
  --dry-run
```

### Deployment with Rollback

```bash
# Deploy
node scripts/orchestrator.mjs --action execute \
  --workflow deploy.json

# If failed, rollback
node scripts/orchestrator.mjs --action retry \
  --run-id <previous-run-id>
```

## Metrics

Track these metrics:

| Metric | Description | Target |
|--------|-------------|--------|
| Duration | Total execution time | < expected |
| Success Rate | % of successful runs | > 95% |
| Retry Count | Average retries per run | < 1 |
| Step Duration | Per-step timing | < timeout |

## Visual Dashboard

A simple HTML dashboard is available at:

```
{skillDir}/dashboard.html
```

Features:
- Summary cards (total, success, failed, running)
- Recent executions table
- Auto-refresh every 30 seconds
- Status indicators

To view:
```bash
# Open in browser
open {skillDir}/dashboard.html

# Or serve locally
cd {skillDir} && python3 -m http.server 8080
```

---

## Skill Metadata

**Created**: 2026-02-17
**Author**: Lei Sau
**Version**: 1.0.0
