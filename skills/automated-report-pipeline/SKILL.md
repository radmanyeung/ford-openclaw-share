---
name: automated-report-pipeline
description: Automated report pipeline that integrates intelligence gathering, analysis, and structured delivery. Supports scheduled execution and triggered output.
version: 1.0.0
metadata:
  clawdbot:
    emoji: 📊
    requires:
      bins: ["node", "jq"]
      env: ["TAVILY_API_KEY"]
    primaryEnv: "TAVILY_API_KEY"
---

# Automated Report Pipeline

End-to-end automated reporting system: research → analyze → synthesize → deliver. Integrates with Tavily API for intelligence gathering and supports multiple output formats.

## Quick Start

```bash
# Generate daily intelligence report
node {baseDir}/scripts/report.mjs daily

# Generate topic-specific report
node {baseDir}/scripts/report.mjs topic "AI trends 2026"

# Trigger immediate report delivery
node {baseDir}/scripts/report.mjs trigger --channel telegram --to USER_ID

# Generate report from predefined config
node {baseDir}/scripts/report.mjs run --config reports/weekly-tech.yaml
```

## Commands

### report.mjs

Main script for generating and delivering reports.

```bash
node {baseDir}/scripts/report.mjs <mode> [query] [options]
```

**Modes:**

| Mode | Description |
|------|-------------|
| `daily` | Generate daily intelligence digest |
| `topic <query>` | Generate report on specific topic |
| `trigger` | Deliver pre-generated report to channel |
| `run --config <file>` | Execute report from configuration file |
| `schedule` | Check scheduled reports and execute if due |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--output` | Output format: `markdown`, `json`, `html` | markdown |
| `--channel` | Delivery channel: `telegram`, `discord`, `slack` | telegram |
| `--to` | Target user/channel ID | from config |
| `--depth` | Research depth: `shallow`, `standard`, `deep` | standard |
| `--sources` | Max sources to analyze | 10 |
| `--schedule` | Schedule cron expression | - |
| `--save` | Save report to file | true |

### Template System

Create custom report templates:

```bash
# List available templates
node {baseDir}/scripts/report.mjs templates

# Generate from template
node {baseDir}/scripts/report.mjs run --template security-weekly
```

## Report Types

### 1. Daily Intelligence Digest

```bash
node {baseDir}/scripts/report.mjs daily --depth shallow
```

Output structure:
```
# 每日情報摘要 - YYYY-MM-DD

## 🔥 頭條要聞
[Top 3 stories]

## 📊 趨勢分析
[Trending topics with data]

## 🎯 重點摘要
[Executive summary]

## 📚 來源
[Source citations]
```

### 2. Topic Deep-Dive

```bash
node {baseDir}/scripts/report.mjs topic "container orchestration 2026" --depth deep
```

Output structure:
```
# 主題研究報告：[Topic]

## 執行摘要
[Executive summary]

## 研究方法
[Research methodology]

## 主要發現
1. [Finding 1]
2. [Finding 2]
...

## 深入分析
### [Subtopic 1]
...

### [Subtopic 2]
...

## 數據與統計
[Charts/data if applicable]

## 結論與建議
[Actionable recommendations]

## 來源與參考
[1-20 sources with links]
```

### 3. Scheduled Report

Configure in `reports/config.yaml`:
```yaml
scheduled:
  - name: "weekly-tech"
    schedule: "0 9 * * 1"  # Monday 09:00
    query: "technology trends"
    depth: standard
    channel: telegram
    to: USER_ID
    format: markdown
```

### 4. Multi-Source Synthesis

```bash
node {baseDir}/scripts/report.mjs synthesize \
  --sources "https://example.com/a" "https://example.com/b" \
  --output json
```

## Output Formats

### Markdown (default)
Clean, readable format for humans.

### JSON
Machine-readable for automation:
```json
{
  "title": "...",
  "timestamp": "...",
  "query": "...",
  "sections": [...],
  "sources": [...],
  "metadata": {...}
}
```

### HTML
Formatted for web viewing or email.

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `TAVILY_API_KEY` | Tavily API key for research |
| `DEFAULT_CHANNEL` | Default delivery channel |
| `DEFAULT_TO` | Default recipient |
| `REPORT_DIR` | Reports output directory |

### Config File

Create `reports/pipeline.yaml`:

```yaml
pipeline:
  default_depth: standard
  max_sources: 15
  timeout_ms: 120000
  
delivery:
  default_channel: telegram
  auto_deliver: false
  
templates:
  intelligence:
    sections: [headlines, trends, analysis, sources]
  technical:
    sections: [summary, methodology, findings, data, recommendations, sources]
```

## Integration Points

### Input Sources
- **Tavily API**: Research queries and content extraction
- **Local Files**: CSV, JSON, Markdown inputs
- **URLs**: Web content extraction
- **APIs**: Custom data source connectors

### Output Targets
- **Telegram**: Direct message or channel post
- **Discord**: Webhook delivery
- **Slack**: Incoming webhook
- **File System**: Markdown/JSON/HTML files
- **Email**: SMTP delivery (via integration)

## Workflow Integration

### Daily Cron Job
```bash
# Add to crontab
0 8 * * * node ~/.openclaw/workspace/skills/automated-report-pipeline/scripts/report.mjs daily
```

### Triggered Report
```bash
# From other scripts
node report.mjs topic "custom query" --trigger --channel slack --to "#reports"
```

## Best Practices

1. **Schedule during low-traffic hours** for heavy reports
2. **Use shallow depth** for daily digests
3. **Use deep research** for strategic analysis only
4. **Always save reports** before delivery (retry on failure)
5. **Validate config** before adding new scheduled reports

## File Structure

```
automated-report-pipeline/
├── SKILL.md
├── scripts/
│   ├── report.mjs          # Main report generator
│   ├── deliver.mjs         # Delivery handler
│   ├── template.mjs        # Template engine
│   └── scheduler.mjs       # Cron scheduler
├── reports/
│   ├── config.yaml         # Pipeline configuration
│   └── templates/          # Report templates
└── output/                 # Generated reports
```

## Error Handling

| Error | Solution |
|-------|----------|
| `TAVILY_API_KEY missing` | Set environment variable |
| `Delivery failed` | Check channel config; report saved to file |
| `Timeout` | Reduce `--sources` or `--depth` |
| `Invalid template` | Check template syntax in config |
