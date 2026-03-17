---
name: log-recovery
description: Enhanced log recovery with structured logging, error classification, rotation, archival, and incremental snapshot checkpoints
version: 1.0.0
tags: ["logging", "recovery", "structured", "checkpoint", "archival"]
inputs: ["log_directory", "error_level", "checkpoint_interval"]
outputs: ["recovered_logs", "error_summary", "checkpoint_list"]
dependencies: ["version-control"]
---

# Log Recovery Skill

## Overview

Provides enhanced log recovery with structured logging format, error classification, automatic rotation and archival, and incremental checkpoint snapshots.

## Features

- **Structured Logging**: JSON-formatted logs with consistent schema
- **Error Classification**: Categorizes errors by type and severity
- **Log Rotation**: Automatic rotation based on size/age
- **Checkpoint Snapshots**: Incremental snapshots for fast recovery
- **Error Recovery**: Reconstructs state from checkpoint history

## Usage

```json
{
  "skill": "log-recovery",
  "inputs": {
    "log_directory": "~/.openclaw/logs",
    "error_level": "error",
    "checkpoint_interval": 100
  }
}
```

## Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| log_directory | string | "./logs" | Directory for log files |
| max_log_size_mb | number | 100 | Maximum log file size |
| retention_days | number | 30 | Log retention period |
| checkpoint_interval | number | 50 | Entries between checkpoints |

## Outputs Structure

```json
{
  "recovered_logs": [...],
  "error_summary": {...},
  "checkpoint_list": [...]
}
```

## Integration

Uses version-control for checkpoint persistence. Compatible with standard log aggregation tools.
