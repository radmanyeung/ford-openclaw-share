---
name: gateway-autoscaler
description: Monitor OpenClaw Gateway health, detect crash loops, auto-restart on failure, and generate diagnostic reports. Use when: (1) Gateway becomes unresponsive, (2) After crash loop recovery, (3) Periodic health monitoring, (4) Generating uptime reports.
version: 1.0.0
tags: ["gateway", "health", "autoscaler", "crash-recovery", "monitoring"]
dependencies: ["cron-health-dashboard"]
---

# Gateway Autoscaler

Automatic Gateway health monitoring and crash recovery skill.

## Quick Start

```bash
# Run health check
bash skills/gateway-autoscaler/scripts/health-check.sh

# Run with auto-restart
bash skills/gateway-autoscaler/scripts/health-check.sh --auto-restart

# JSON output for automation
bash skills/gateway-autoscaler/scripts/health-check.sh --json
```

## Features

- **Health Monitoring**: Check Gateway process status, port connectivity
- **Crash Detection**: Analyze restart counts, identify crash loops
- **Auto-Restart**: Automatic recovery on failure (configurable)
- **Diagnostic Report**: Generate detailed reports for debugging

## Workflow

1. Check `openclaw status` for basic health
2. Inspect recent logs (`/tmp/openclaw/openclaw-*.log`)
3. Query `journalctl` for crash history
4. If unhealthy + auto-restart enabled → restart gateway
5. Output status report

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Restart count (1h) | > 3 | > 10 |
| Memory usage | > 80% | > 95% |
| Response time | > 5s | > 30s |
