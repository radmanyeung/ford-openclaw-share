---
name: tavily-research-agent
description: AI-optimized research assistant with structured search, content extraction, and report generation via Tavily API. Ideal for deep research, fact-checking, and comprehensive topic analysis.
version: 1.0.0
homepage: https://tavily.com
metadata:
  clawdbot:
    emoji: 🔬
    requires:
      bins: ["node"]
      env: ["TAVILY_API_KEY"]
    primaryEnv: "TAVILY_API_KEY"
---

# Tavily Research Agent

AI-powered research assistant that combines Tavily's high-speed search with structured report generation. Designed for deep research tasks requiring comprehensive, well-sourced information.

## Quick Start

```bash
# Basic research query
node {baseDir}/scripts/research.mjs "impact of AI on software development"

# Deep research with multiple queries
node {baseDir}/scripts/research.mjs "quantum computing applications" --deep

# Generate report from specific URLs
node {baseDir}/scripts/research.mjs --sources "https://example.com/article1" "https://example.com/article2"

# News-focused research
node {baseDir}/scripts/research.mjs "latest AI regulations" --topic news --days 7

# Quick fact extraction
node {baseDir}/scripts/extract.mjs "https://example.com/technical-doc"
```

## Commands

### Research Command

The `research.mjs` script performs comprehensive research on a topic:

```bash
node {baseDir}/scripts/research.mjs "your research question" [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --max-results` | Number of search results | 10 |
| `-d, --deep` | Enable deep research mode (auto-generates follow-up queries) | false |
| `--topic` | Search topic: `general` or `news` | general |
| `--days` | Days back for news search | 7 |
| `-s, --sources` | Extract from specific URLs instead of searching | - |
| `-o, --output` | Output format: `json` or `markdown` | markdown |
| `--verbose` | Show detailed intermediate results | false |

**Deep Research Mode:**

When `--deep` is enabled, the agent:
1. Performs initial search to understand the topic landscape
2. Generates follow-up queries based on findings
3. Iterates to gather comprehensive coverage
4. Produces structured synthesis report

### Extract Command

Extract clean text content from specific URLs:

```bash
node {baseDir}/scripts/extract.mjs "https://example.com/article" [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--format` | Output format: `json`, `markdown`, or `text` | markdown |
| `--max-length` | Maximum characters to extract | 10000 |
| `--verbose` | Show extraction metadata | false |

## Research Workflows

### Workflow 1: Quick Fact Check

Use for rapid verification of facts or definitions:

```bash
node {baseDir}/scripts/research.mjs "What is transformer architecture?" --max-results 5
```

Output includes:
- Concise definition
- Key concepts
- Source citations

### Workflow 2: Deep Research Report

For comprehensive analysis of complex topics:

```bash
node {baseDir}/scripts/research.mjs "sustainable energy storage solutions 2024" --deep --max-results 15
```

Output structure:
```
1. Executive Summary
2. Key Findings
3. Detailed Analysis (with subsections)
4. Sources & References
5. Research Methodology
```

### Workflow 3: Source Deep-Dive

Extract and analyze specific articles:

```bash
node {baseDir}/scripts/research.mjs -s "https://techcrunch.com/2024/01/ai-news" "https://wired.com/ai-analysis"
```

### Workflow 4: News Monitoring

Track recent developments:

```bash
node {baseDir}/scripts/research.mjs "OpenAI GPT-5 announcements" --topic news --days 3 --output json
```

## Output Formats

### Markdown (default)

```markdown
# Research Report: [Topic]

## Executive Summary
[Brief overview of findings]

## Key Findings
1. [Finding 1]
2. [Finding 2]
...

## Detailed Analysis
[Subtopic 1]
- Point A
- Point B

[Subtopic 2]
...

## Sources
1. [Title](URL) - [Domain]
2. ...
```

### JSON

```json
{
  "query": "...",
  "timestamp": "2026-02-18T02:00:00Z",
  "summary": "...",
  "findings": [...],
  "sources": [...],
  "research_depth": "standard|deep"
}
```

## Configuration

Set your Tavily API key:

```bash
export TAVILY_API_KEY="your-api-key"
```

Get your API key from: https://tavily.com

## Integration Notes

- **Low latency**: ~180ms response time for search queries
- **AI-optimized**: Returns clean, relevant content without SEO noise
- **Safe filtering**: Built-in content filtering for inappropriate content
- **No Brave dependency**: Self-contained search solution
- **Batch support**: Process multiple URLs in single extract call

## Best Practices

1. **Start with focused queries**: Broad questions yield shallow results
2. **Use `--deep` for complex topics**: Auto-generates follow-up queries
3. **Specify date ranges for news**: `--days 7` for last week's news
4. **Combine with extract**: Research first, then deep-dive sources
5. **Use JSON for automation**: Parsable output for downstream processing

## Error Handling

| Error | Solution |
|-------|----------|
| `401 Unauthorized` | Check TAVILY_API_KEY environment variable |
| `429 Rate Limited` | Reduce request frequency or check quota |
| `ENOTFOUND` | Verify URL is accessible |
| `Timeout` | Reduce `--max-results` or `--max-length` |
