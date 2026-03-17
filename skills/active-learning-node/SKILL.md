---
name: active-learning-node
description: Pattern recognition, preference learning, and self-improvement from session outcomes. Implements learning loops across sessions to improve future interactions.
version: 1.0.0
---

# Active Learning Node

Pattern recognition and self-improvement system that learns from session outcomes, user feedback, and behavioral patterns to optimize future interactions.

## When to Activate

Activate this skill when:
- User provides correction or clarification
- Recurring patterns detected across sessions
- Optimizing responses based on past outcomes
- Generating skill recommendations based on task type
- Improving tone/style based on user preferences
- Identifying common failure modes and preventing them

## Core Concepts

### Learning Loop Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Active Learning Cycle                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐           │
│   │   Observe   │ ───▶ │   Extract   │ ───▶ │   Abstract  │           │
│   │  (session)  │      │  (patterns) │      │  (principle)│           │
│   └─────────────┘      └─────────────┘      └─────────────┘           │
│         ▲                                           │                  │
│         │                                           ▼                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐           │
│   │   Apply     │ ◀─── │   Retrieve  │ ◀─── │   Store     │           │
│   │  (insight)  │      │  (relevant) │      │  (knowledge)│           │
│   └─────────────┘      └─────────────┘      └─────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Learning Types

| Type | Trigger | Storage | Application |
|------|---------|---------|-------------|
| **Preference** | User correction | preference-patterns.json | Response styling |
| **Performance** | Task outcome | performance-metrics.json | Efficiency optimization |
| **Correction** | User rejection | correction-log.json | Prevent recurrence |
| **Success** | Task completion | success-patterns.json | Replicate approach |
| **Interaction** | Behavioral pattern | interaction-model.json | Timing and approach |

### Pattern Categories

1. **User Preferences**: Tone, format, verbosity, timezone awareness
2. **Task Patterns**: Common workflows, typical blockers, optimal approaches
3. **Failure Patterns**: What went wrong, how it was fixed, how to prevent
4. **Skill Patterns**: Which skills work best for which task types

## File Structure

```
active-learning-node/
├── SKILL.md                    # This file
├── registry.json               # Skill registration
├── scripts/
│   ├── learn.mjs              # Main learning engine
│   ├── pattern-detector.mjs   # Detect patterns from sessions
│   └── recommendation.mjs     # Generate skill recommendations
├── references/
│   ├── preference-patterns.json
│   ├── performance-metrics.json
│   ├── correction-log.json
│   ├── success-patterns.json
│   └── interaction-model.json
└── README.md
```

## Usage

### Learn from User Correction

```bash
# Record a correction from user
node scripts/learn.mjs --action correct \
  --input "User rejected response because too verbose" \
  --context "Was explaining memory system in technical detail" \
  --outcome "Prefer concise bullet points for user"

# Mark successful approach
node scripts/learn.mjs --action success \
  --input "Quick summary with diagram worked well" \
  --context "User asked about architecture overview" \
  --outcome "Use visual diagrams for complex systems"
```

### Detect Patterns

```bash
# Scan recent sessions for patterns
node scripts/pattern-detector.mjs --action scan \
  --sessions 10 \
  --output patterns.json

# Analyze specific pattern type
node scripts/pattern-detector.mjs --action analyze \
  --type preference \
  --threshold 3
```

### Get Recommendations

```bash
# Recommend skills for task
node scripts/recommendation.mjs --task "debug_auth_error" \
  --context "debugging JWT authentication failure"

# Generate improvement suggestions
node scripts/recommendation.mjs --action improve \
  --focus response_quality
```

## Scripts

### learn.mjs

Main learning interface.

```bash
node scripts/learn.mjs --action <action> [options]
```

**Actions:**
- `correct` - Record user correction/negativity
- `success` - Record successful outcome
- `preference` - Infer preference from behavior
- `feedback` - Record explicit user feedback
- `summarize` - Create session-level learning summary

**Options:**
- `--input, -i` - What happened
- `--context, -c` - Situation description
- `--outcome, -o` - Resulting pattern/principle
- `--session` - Session ID for reference
- `--tags` - Pattern tags (comma-separated)

### pattern-detector.mjs

Pattern detection and analysis.

```bash
node scripts/pattern-detector.mjs --action <action> [options]
```

**Actions:**
- `scan` - Scan sessions for patterns
- `analyze` - Analyze specific pattern type
- `export` - Export patterns for review
- `merge` - Merge similar patterns

**Options:**
- `--sessions, -s` - Number of sessions to scan
- `--type, -t` - Pattern type (preference/performance/correction)
- `--threshold, -th` - Minimum occurrences for pattern
- `--output, -o` - Output file path

### recommendation.mjs

Skill and approach recommendations.

```bash
node scripts/recommendation.mjs --action <action> [options]
```

**Actions:**
- `recommend` - Recommend skills for task
- `improve` - Generate improvement suggestions
- `explain` - Explain pattern rationale

**Options:**
- `--task, -t` - Task description
- `--context, -c` - Additional context
- `--focus, -f` - Improvement focus area
- `--count` - Number of recommendations

## Integration

### With Memory System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Learning Data Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Session End ──▶ Extract patterns ──▶ Update pattern files     │
│        │                                      │                 │
│        ▼                                      ▼                 │
│  Context Summary ◀────── Retrieve ─────── Pattern Database     │
│        │                                      │                 │
│        ▼                                      ▼                 │
│  Next Session ◀────── Apply learned ─────── Preferences        │
│                        insights                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### With Skill Registry

```bash
# Learn which skills work best
node scripts/learn.mjs --action success \
  --input "Used code-review skill for PR feedback" \
  --context "PR with security concerns" \
  --outcome "code-review + securityreview combination optimal"
```

### With Heartbeat

```bash
# Learning check during heartbeat
node scripts/pattern-detector.mjs --action scan \
  --sessions 5 --threshold 2

# Generate weekly learning report
node scripts/learn.mjs --action summarize --period weekly
```

## Pattern Files Format

### preference-patterns.json

```json
{
  "version": "1.0.0",
  "patterns": [
    {
      "id": "pref-001",
      "pattern": "concise_over_verbose",
      "description": "User prefers concise bullet points over lengthy explanations",
      "triggers": ["technical_explanation", "system_overview"],
      "confidence": 0.85,
      "occurrences": 5,
      "last_seen": "2026-02-19T14:00:00Z",
      "action": {
        "response_length": "short",
        "format": "bullet_points",
        "detail_level": "summary_only"
      }
    }
  ]
}
```

### correction-log.json

```json
{
  "version": "1.0.0",
  "corrections": [
    {
      "id": "corr-001",
      "type": "tone_correction",
      "input": "Too casual/humorous response",
      "context": "User asked about serious security issue",
      "outcome": "Use formal tone for security topics",
      "prevention": "Check topic type before deciding tone",
      "severity": "medium",
      "occurred": "2026-02-19T10:30:00Z",
      "prevented_count": 3
    }
  ]
}
```

### performance-metrics.json

```json
{
  "version": "1.0.0",
  "metrics": [
    {
      "id": "perf-001",
      "metric": "response_approval_rate",
      "value": 0.92,
      "trend": "improving",
      "improvement_strategy": "Continue bullet point format",
      "sessions_tracked": 20
    }
  ]
}
```

## Best Practices

1. **Learn from every interaction**: Every correction is an opportunity
2. **Build confidence scores**: Multiple occurrences increase confidence
3. **Context matters**: Same preference may not apply in all situations
4. **Track prevention**: Count how many times a correction was prevented
5. **Regular pattern review**: Weekly analysis prevents pattern drift
6. **Merge similar patterns**: Avoid pattern explosion with consolidation
7. **Explain to user**: When applying learned pattern, briefly explain why

## Common Workflows

### End-of-Session Learning

```bash
# Extract patterns from completed session
node scripts/pattern-detector.mjs --action scan \
  --sessions 1 --output current-patterns.json

# Apply to learning database
node scripts/learn.mjs --action import \
  --source current-patterns.json
```

### Post-Correction Learning

```bash
# User corrects response
node scripts/learn.mjs --action correct \
  --input "Response was too verbose" \
  --context "Explaining memory system with full details" \
  --outcome "Prefer summary first, detail on request"
```

### Proactive Improvement

```bash
# Analyze recent performance
node scripts/pattern-detector.mjs --action analyze \
  --type performance --threshold 3

# Generate recommendations
node scripts/recommendation.mjs --action improve \
  --focus response_quality
```

## Metrics

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Preference Confidence | > 0.7 | Need more observations |
| Correction Prevention Rate | > 0.8 | Review prevention logic |
| Pattern Accuracy | > 0.9 | Validate with user feedback |
| Learning Frequency | > 5/week | Increase observation focus |

## Skill Metadata

**Created**: 2026-02-19
**Author**: Lei Sau
**Version**: 1.0.0
**Dependencies**: context-aware-memory, skill-registry
