---
name: openclaw-config
description: Manage OpenClaw configuration files (openclaw.json, gateway settings). Use when viewing, editing, validating, or resetting OpenClaw configurations.
version: 1.0.0
---

# OpenClaw Config Manager

Manage OpenClaw gateway, workspace configuration, model providers, and agent model assignments.

## When to Use

- View or edit OpenClaw configuration
- Add/remove model providers (OpenAI, NVIDIA, Groq, etc.)
- Assign specific models to agents with fallbacks
- Configure fallback chains for model failover
- Validate configuration files
- Check gateway status
- Reset or backup configuration

## Available Tools

### CLI Tool (scripts/openclaw-config.mjs)

Comprehensive command-line interface for all config operations:

```bash
# View help
node scripts/openclaw-config.mjs help

# Provider Management
node scripts/openclaw-config.mjs provider add <name> <endpoint> [apiKey] [models...]
node scripts/openclaw-config.mjs provider remove <name>
node scripts/openclaw-config.mjs provider update <name> <field> <value>
node scripts/openclaw-config.mjs provider list

# Agent Model Assignment
node scripts/openclaw-config.mjs agent set <agentName> <model> [fallback1,fallback2...]
node scripts/openclaw-config.mjs agent remove <agentName>
node scripts/openclaw-config.mjs agent list

# Fallback Chain Configuration
node scripts/openclaw-config.mjs fallback add <model> <fallbackModel>
node scripts/openclaw-config.mjs fallback remove <model> <fallbackModel>
node scripts/openclaw-config.mjs fallback list

# Display
node scripts/openclaw-config.mjs show          # Full config (JSON)
node scripts/openclaw-config.mjs show provider <name>
node scripts/openclaw-config.mjs show agent <agentName>
```

### Legacy Scripts

```bash
# View current configuration
node scripts/view.mjs [--json]

# Edit configuration
node scripts/edit.mjs <path> <value>

# Validate configuration
node scripts/validate.mjs

# Check gateway status
node scripts/status.mjs

# Backup/restore configuration
node scripts/backup.mjs [--restore]

# List environment variables
node scripts/env.mjs
```

## Configuration Structure

OpenClaw uses multiple configuration sources:

1. **Gateway Config**: `~/.config/openclaw/config.json` or environment variables
2. **Workspace Config**: `~/.openclaw/workspace/openclaw.json`
3. **Skill Registries**: `skills/*/registry.json`

### Full Schema

```json
{
  "$schema": "./skills/openclaw-config/references/config-schema.json",
  "gateway": {
    "host": "localhost",
    "port": 3000,
    "profile": "default"
  },
  "models": {
    "default": "nvidia-integrate/minimaxai/minimax-m2.1",
    "maxTokens": 128000,
    "providers": {
      "nvidia": {
        "apiKey": "nvapi-xxx",
        "endpoint": "https://integrate.api.nvidia.com/v1",
        "models": ["qwen/qwen3.5-397b", "nvidia/nemotron"]
      }
    },
    "agents": {
      "coder": {
        "model": "nvidia-integrate/minimaxai/minimax-m2.1",
        "fallback": ["nvidia/qwen3.5-397b", "groq/llama3"]
      }
    },
    "fallbacks": {
      "nvidia-integrate/minimaxai/minimax-m2.1": ["nvidia/qwen3.5-397b"]
    }
  },
  "channels": {
    "webchat": { "enabled": true },
    "telegram": { "token": "...", "chatId": "..." }
  },
  "memory": {
    "contextLimit": 200000,
    "compression": true,
    "autoSummarize": true
  },
  "skills": {
    "path": "./skills",
    "autoLoad": true
  }
}
```

## Examples

### Adding a New Provider

```bash
# Add OpenAI provider
node scripts/openclaw-config.mjs provider add openai \
  https://api.openai.com/v1 \
  sk-your-api-key \
  gpt-4,gpt-4-turbo,gpt-3.5-turbo
```

### Assigning Models to Agents

```bash
# Set agent with model and agent-specific fallbacks
node scripts/openclaw-config.mjs agent set coder \
  nvidia-integrate/minimaxai/minimax-m2.1 \
  nvidia/qwen3.5-397b,groq/llama3

# Set reasoning agent with different model
node scripts/openclaw-config.mjs agent set reasoner \
  openai/gpt-4-turbo \
  openai/gpt-4
```

### Configuring Global Fallback Chains

```bash
# If primary model fails, try these in order
node scripts/openclaw-config.mjs fallback add \
  nvidia-integrate/minimaxai/minimax-m2.1 \
  nvidia/qwen3.5-397b

node scripts/openclaw-config.mjs fallback add \
  nvidia/qwen3.5-397b \
  groq/llama3-70b
```

### Viewing Configuration

```bash
# List all providers
node scripts/openclaw-config.mjs provider list

# List all agent assignments
node scripts/openclaw-config.mjs agent list

# List all fallback chains
node scripts/openclaw-config.mjs fallback list

# Show full config
node scripts/openclaw-config.mjs show
```

## Integration Points

- **Provider**: Used by `openclaw gateway` when making model API calls
- **Agents**: Used by `sessions_spawn` to resolve agent model assignments
- **Fallbacks**: Used automatically when model API calls fail
