---
name: tavily
description: AI-optimized web search via Tavily API. Returns concise, relevant results for AI agents.
version: 1.1.0
homepage: https://tavily.com
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["node"],"env":["TAVILY_API_KEY"]},"primaryEnv":"TAVILY_API_KEY"}}
metadata:
  changes:
    - "1.1.0: Added result caching (default 1hr TTL), --no-cache, --cache-ttl options"
---

# Tavily Search

AI-optimized web search using Tavily API. Designed for AI agents - returns clean, relevant content.

## Search

```bash
node {baseDir}/scripts/search.mjs "query"
node {baseDir}/scripts/search.mjs "query" -n 10
node {baseDir}/scripts/search.mjs "query" --deep
node {baseDir}/scripts/search.mjs "query" --topic news
```

## Options

- `-n <count>`: Number of results (default: 5, max: 20)
- `--deep`: Use advanced search for deeper research (slower, more comprehensive)
- `--topic <topic>`: Search topic - `general` (default) or `news`
- `--days <n>`: For news topic, limit to last n days
- `--no-cache`: Skip cache and fetch fresh results
- `--cache-ttl <seconds>`: Cache TTL in seconds (default: 3600 = 1 hour)

## Caching

Results are cached locally to reduce API calls:

- Default TTL: 1 hour
- Cache location: `{skillDir}/scripts/.cache/`
- Use `--no-cache` to skip cache
- Use `--cache-ttl 1800` for 30-minute cache

## Extract content from URL

```bash
node {baseDir}/scripts/extract.mjs "https://example.com/article"
```

Notes:
- Needs `TAVILY_API_KEY` from https://tavily.com
- Tavily is optimized for AI - returns clean, relevant snippets
- Use `--deep` for complex research questions
- Use `--topic news` for current events
