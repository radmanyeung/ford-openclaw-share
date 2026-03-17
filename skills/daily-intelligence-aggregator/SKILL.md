---
name: daily-intelligence-aggregator
description: Multi-source daily intelligence aggregator that collects and summarizes information from RSS/Atom feeds, Telegram channels, and Slack channels. Integrates with Tavily API for deep research on key topics.
version: 1.0.0
---

# Daily Intelligence Aggregator

Multi-source daily intelligence aggregator that collects, filters, and summarizes information from RSS feeds, Telegram channels, and Slack channels with optional deep research.

## When to Use

- Daily information digest and briefing
- Topic monitoring across multiple sources
- Competitive intelligence gathering
- Research lead discovery
- Trend analysis from diverse sources

## Core Functions

### 1. Source Types

| Source | Config Key | Description |
|--------|------------|-------------|
| RSS/Atom | `rss` | News feeds, blogs, update streams |
| Telegram | `telegram` | Channel messages via API |
| Slack | `slack` | Channel archives and search |

### 2. Processing Pipeline

```
Raw Sources → Deduplication → Relevance Filter → Summarization → Intelligence Report
```

### 3. Tavily Integration

- Deep research on top stories
- Fact-checking capability
- Source verification
- Related topic discovery

## Configuration

Create `config.json` in the skill directory:

```json
{
  "sources": {
    "rss": [
      "https://example.com/feed.xml",
      "https://news.example.com/rss"
    ],
    "telegram": [
      {
        "channel": "@my_channel",
        "limit": 50
      }
    ],
    "slack": [
      {
        "channel": "#general",
        "limit": 100,
        "query": "tech news"
      }
    ]
  },
  "tavily": {
    "enabled": true,
    "max_queries": 5,
    "search_depth": "advanced"
  },
  "filter": {
    "keywords": ["AI", "machine learning", "automation"],
    "exclude": ["ads", "promoted"]
  },
  "output": {
    "format": "markdown",
    "max_items": 20,
    "summary_length": 200
  }
}
```

## Usage

```bash
# Run daily aggregation
node scripts/aggregate.mjs

# Run with custom config
node scripts/aggregate.mjs --config /path/to/config.json

# Quick mode (no Tavily research)
node scripts/aggregate.mjs --quick

# Since midnight only
node scripts/aggregate.mjs --today

# Summarize specific sources
node scripts/aggregate.mjs --sources rss,telegram

# Debug mode (show raw items)
node scripts/aggregate.mjs --debug
```

## Output Format

```markdown
# Daily Intelligence Report - 2026-02-19

## 📊 Summary
- **12** RSS articles processed
- **8** Telegram messages filtered
- **3** Slack messages matched
- **5** topics sent to Tavily

## 🔥 Top Stories

### 1. [Article Title](url)
**Source:** RSS | **Relevance:** High
> Brief summary...

### 2. [Telegram Channel Post](url)
**Source:** Telegram | **Relevance:** Medium
> Key points...

## 🔬 Deep Research

### Topic: AI Automation Trends
Tavily search results:
- [Source 1](url) - Key finding...
- [Source 2](url) - Key finding...

## 📋 All Items

| Time | Source | Title | Relevance |
|------|--------|-------|-----------|
| 09:15 | RSS | Tech News... | High |
| 10:30 | Telegram | Update... | Medium |
```

## Scheduling

Add to cron for daily execution:

```bash
# Daily at 08:00
0 8 * * * cd /path/to/skill && node scripts/aggregate.mjs --quick
```

## API Keys Required

- **Telegram**: `TELEGRAM_BOT_TOKEN` + channel access
- **Slack**: `SLACK_BOT_TOKEN`
- **Tavily**: `TAVILY_API_KEY`
