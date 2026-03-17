---
name: workflow-template-library
description: Pre-defined workflow template library for rapid deployment and reuse. Standardize common patterns across projects.
metadata:
  clawdbot:
    emoji: 📋
    requires:
      bins: ["node"]
      env: []
    primaryEnv: ""
---

# Workflow Template Library

Pre-defined workflow templates for common automation patterns. Deploy standardized workflows in minutes, not hours.

## Quick Start

```bash
# List available templates
node {baseDir}/scripts/templates.mjs list

# Deploy a template
node {baseDir}/scripts/templates.mjs deploy research-pipeline --name my-research

# Preview template configuration
node {baseDir}/scripts/templates.mjs preview data-pipeline

# Validate template
node {baseDir}/scripts/templates.mjs validate template-name
```

## Commands

### templates.mjs

Main script for template management.

```bash
node {baseDir}/scripts/templates.mjs <command> [template] [options]
```

**Commands:**

| Command | Description |
|---------|-------------|
| `list` | List all available templates |
| `preview <template>` | Show template configuration |
| `deploy <template>` | Deploy template to workspace |
| `validate <template>` | Check template validity |
| `create <name>` | Create new custom template |
| `export <template>` | Export template as portable file |
| `import <file>` | Import external template |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--name` | Deployment name | auto-generated |
| `--output` | Output directory | ./workflows |
| `--force` | Overwrite existing | false |
| `--config` | Custom config values | - |

## Available Templates

### 1. research-pipeline

Automated research workflow with Tavily integration.

```bash
node templates.mjs deploy research-pipeline --name my-research
```

Generates:
```
my-research/
├── config.yaml              # Research configuration
├── scripts/
│   ├── run-research.sh      # Main research script
│   └── synthesize.sh        # Report synthesis
├── reports/                  # Output directory
└── README.md
```

**Config options:**
- `query`: Research topic
- `depth`: shallow, standard, deep
- `sources`: max sources to analyze
- `schedule`: cron expression

### 2. data-pipeline

ETL data processing workflow.

```bash
node templates.mjs deploy data-pipeline --name etl-process
```

Generates:
```
etl-process/
├── config.yaml
├── scripts/
│   ├── extract.sh           # Data extraction
│   ├── transform.sh         # Data transformation
│   └── load.sh              # Data loading
├── data/
│   ├── input/               # Raw data
│   └── output/              # Processed data
└── README.md
```

### 3. backup-automation

Encrypted backup workflow.

```bash
node templates.mjs deploy backup-automation --name daily-backup
```

Generates:
```
daily-backup/
├── config.yaml
├── scripts/
│   ├── encrypt.sh           # AES-256 encryption
│   ├── upload.sh            # Cloud upload
│   └── verify.sh            # Integrity check
├── keys/                     # Encryption keys (gitignored)
└── README.md
```

### 4. monitoring-dashboard

System monitoring with alerting.

```bash
node templates.mjs deploy monitoring-dashboard --name server-monitor
```

Generates:
```
server-monitor/
├── config.yaml
├── scripts/
│   ├── collect.sh           # Metrics collection
│   ├── alert.sh             # Alert triggers
│   └── report.sh            # Daily reports
├── dashboards/              # Grafana dashboards
└── README.md
```

### 5. skill-generator

Standard skill scaffold for OpenClaw.

```bash
node templates.mjs deploy skill-generator --name my-new-skill
```

Generates:
```
my-new-skill/
├── SKILL.md                 # Skill documentation
├── scripts/
│   └── main.mjs             # Main entry point
├── config.yaml              # Template configuration
└── README.md
```

### 6. api-gateway

REST API wrapper with rate limiting.

```bash
node templates.mjs deploy api-gateway --name my-api
```

Generates:
```
my-api/
├── config.yaml
├── src/
│   ├── index.js             # Express server
│   ├── routes/              # API routes
│   ├── middleware/          # Auth, rate limit
│   └── services/            # Business logic
└── README.md
```

## Custom Templates

### Create Custom Template

```bash
node templates.mjs create my-workflow
```

Opens interactive wizard to define:
- Template name
- Description
- Directory structure
- Config variables
- Scripts

### Template Structure

```
workflow-template-library/
├── templates/
│   ├── my-template/
│   │   ├── config.yaml         # Template config & variables
│   │   ├── template.yaml       # Template metadata
│   │   ├── structure.yaml      # File structure
│   │   └── files/              # Template files
│   │       ├── config.template.yaml
│   │       └── scripts/
│   │           └── run.sh
└── scripts/
    └── templates.mjs
```

### template.yaml

```yaml
name: my-template
version: 1.0.0
description: My custom workflow template

variables:
  - name: PROJECT_NAME
    prompt: "Enter project name"
    required: true
    
  - name: API_KEY
    prompt: "API Key (will be masked)"
    required: false
    secret: true
    
  - name: SCHEDULE
    prompt: "Cron schedule"
    default: "0 2 * * *"

hooks:
  pre_deploy: |
    echo "Preparing deployment..."
  post_deploy: |
    echo "Deployment complete!"
```

### structure.yaml

```yaml
directories:
  - "{{PROJECT_NAME}}"
  - "{{PROJECT_NAME}}/scripts"
  - "{{PROJECT_NAME}}/data"

files:
  - path: "{{PROJECT_NAME}}/config.yaml"
    template: files/config.template.yaml
  - path: "{{PROJECT_NAME}}/README.md"
    template: files/README.md
```

## Deployment Examples

### Example 1: Deploy with Custom Config

```bash
node templates.mjs deploy research-pipeline \
  --name tech-research \
  --config depth=deep,sources=20 \
  --config schedule="0 9 * * 1"
```

### Example 2: Preview Before Deploy

```bash
node templates.mjs preview data-pipeline

# Output:
# Template: data-pipeline
# Description: ETL data processing workflow
# Variables:
#   - PROJECT_NAME (required)
#   - SCHEDULE (default: 0 2 * * *)
# Files generated:
#   - {PROJECT_NAME}/config.yaml
#   - {PROJECT_NAME}/scripts/extract.sh
#   ...
```

### Example 3: Export Template for Sharing

```bash
node templates.mjs export research-pipeline --output ./share/
# Creates portable template package
```

### Example 4: Import External Template

```bash
node templates.mjs import ./external-template.zip
# Adds template to library
```

## Template Variables

### Built-in Variables

| Variable | Description |
|----------|-------------|
| `{{PROJECT_NAME}}` | Deployment name |
| `{{DATE}}` | Current date (YYYY-MM-DD) |
| `{{TIMESTAMP}}` | Unix timestamp |
| `{{USER}}` | Current user |

### Custom Variables

Defined in `template.yaml` or passed via `--config`:

```bash
--config key1=value1,key2=value2
```

### Variable Types

| Type | Description | Example |
|------|-------------|---------|
| string | Plain text | `project-alpha` |
| number | Numeric value | `42` |
| boolean | true/false | `true` |
| secret | Masked input | (API keys) |
| choice | Predefined options | `shallow,standard,deep` |

## Workflow Integration

### Cron Job from Template

```bash
# Deploy template
node templates.mjs deploy monitoring-dashboard --name sys-monitor

# Add to crontab
crontab -e
# Add: 0 * * * * /path/to/sys-monitor/scripts/collect.sh
```

### Git Workflow

```bash
# Deploy template as git submodule
node templates.mjs deploy api-gateway --name backend-api
cd backend-api
git init
git add .
git commit -m "Initial from template"
```

### Docker Integration

```bash
# Templates with Docker support
node templates.mjs deploy api-gateway --name my-api --include-docker
```

## File Structure

```
workflow-template-library/
├── SKILL.md
├── scripts/
│   └── templates.mjs         # Main template manager
├── templates/
│   ├── research-pipeline/
│   │   ├── config.yaml
│   │   ├── structure.yaml
│   │   ├── template.yaml
│   │   └── files/
│   │       ├── run.sh
│   │       └── config.yaml
│   ├── data-pipeline/
│   ├── backup-automation/
│   ├── monitoring-dashboard/
│   ├── skill-generator/
│   └── api-gateway/
└── docs/
    └── TEMPLATE_FORMAT.md
```

## Best Practices

1. **Version templates** - Track changes with version in template.yaml
2. **Validate before deploy** - Catch errors early
3. **Use secrets** - Never hardcode API keys
4. **Document variables** - Clear prompts reduce errors
5. **Test deployments** - Verify templates work in clean environment

## Error Handling

| Error | Solution |
|-------|----------|
| `Template not found` | Check `list` for valid templates |
| `Missing variable` | Provide required `--config` values |
| `Directory exists` | Use `--force` or choose different name |
| `Invalid template` | Validate with `validate` command |
| `Permission denied` | Check file/directory permissions |
