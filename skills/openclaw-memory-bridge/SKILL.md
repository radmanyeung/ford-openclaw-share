---
name: openclaw-memory-bridge
description: Bridges Claude Code memory with OpenClaw's LanceDB vector memory system. Automatically syncs memory files, stores findings, and searches shared memory — enabling bidirectional knowledge sharing between Claude Code and OpenClaw agents.
---

# OpenClaw Memory Bridge

You have access to a shared memory system with OpenClaw agents via LanceDB. Use it to persist and retrieve knowledge across both systems.

## Tools

### Store a memory

When you learn something important (system decisions, config changes, debug findings, user preferences), store it:

```bash
source ~/.openclaw/.env && node ~/.openclaw/scripts/memory-bridge.mjs store "TEXT" CATEGORY SCOPE IMPORTANCE
```

Parameters:
- `TEXT`: The memory content (max ~2000 chars)
- `CATEGORY`: `preference` | `fact` | `decision` | `entity` | `other` (default: `fact`)
- `SCOPE`: `global` (default) or a custom scope
- `IMPORTANCE`: `0.0` to `1.0` (default: `0.7`)

### Search shared memory

Before starting complex tasks, search for relevant context from OpenClaw agents:

```bash
source ~/.openclaw/.env && node ~/.openclaw/scripts/memory-bridge.mjs search "QUERY" MAX_RESULTS
```

Returns JSON array with `id`, `text`, `category`, `scope`, `score`, `timestamp`.

### Sync all memory files

Push all Claude Code memory files (`~/.claude/projects/-home-ubuntu/memory/*.md`) into LanceDB:

```bash
source ~/.openclaw/.env && node ~/.openclaw/scripts/memory-bridge.mjs sync
```

Files are chunked by `## ` headings. Each chunk is tagged with `[claude-code/FILENAME]` for source tracking.

## When to Store

- After completing system maintenance or configuration changes
- When discovering important patterns or debugging insights
- When the user explicitly asks to remember something
- After resolving issues that OpenClaw agents should know about

## When to Search

- Before modifying OpenClaw configuration (agents may have stored relevant context)
- When the user asks about past decisions or system history
- When you need context that OpenClaw agents may have captured from Telegram conversations

## Categories Guide

| Category | Use for |
|---|---|
| `decision` | Architecture choices, config changes, why something was done |
| `fact` | System state, versions, known issues, documentation |
| `preference` | User preferences, workflow habits, communication style |
| `entity` | People, services, API endpoints, project names |
| `other` | Anything that doesn't fit above |

## Important Notes

- Memories are embedded via Jina API — rate limits apply (auto-retry with backoff)
- `JINA_API_KEY` must be set (loaded from `~/.openclaw/.env`)
- Stored memories are tagged with `source: "claude-code"` metadata
- OpenClaw agents can recall these memories using their `memory_recall` tool
- A PostToolUse hook auto-syncs when you edit files under `/memory/`
