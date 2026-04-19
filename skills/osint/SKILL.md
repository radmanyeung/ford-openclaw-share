---
name: osint
description: On-demand OSINT triage on a public subject. Runs the osint-triage workflow (9 agent steps, 15-30 min) and delivers a hedged draft .md. Draft only — human analyst must verify.
version: 1.0.0
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["node"]}}}
---

# OSINT

Wrapper around the `osint-triage` workflow (defined in `workflow-orchestrator`).
Exposed as slash command `/osint` on supported channels.

## When to Activate

User invokes with:
- `/osint <subject>`
- `/osint <subject> | scope: <notes>`
- Free-text trigger: `osint triage: <subject>` or `幫我 OSINT <subject>`

## ⚠️ HARD RULE — ACK-ONLY, DO NOT EXECUTE

**You DO NOT run the workflow yourself.** A server-side dispatcher
(`~/.openclaw/scripts/osint-dispatcher.py`, cron every minute) handles
`/osint` triggers by reading this session log and firing `run.sh` directly.
Your ONLY job when this skill fires is to reply with a short ACK and STOP:

> 「OSINT dispatcher 已接手 <subject>。workflow 要跑 15–30 分鐘，完成後會直接
> send 一份 .md 返呢個 chat。**Draft only — 人工 analyst 要再核實**。」

You are FORBIDDEN from:
- Synthesizing / paraphrasing any OSINT content (names, events, numbers, URLs)
- Pretending to "run" the workflow or claim progress — the dispatcher does that
- Attempting to shell-exec `run.sh` yourself (duplicate run → double delivery)

Reason: prior incidents (2026-04-19) where the agent hallucinated a report
within seconds while no orchestrator run existed on disk. Server-side
dispatcher makes the pipeline deterministic; your role is only user-facing
acknowledgment.

## Ethics Precheck (do BEFORE running)

1. Confirm `<subject>` is a **public figure / public entity**. If it looks
   like a private individual, a minor, or targets someone for harassment —
   REFUSE politely and do NOT run the workflow.
2. Only run if the requester is on the owner allow list (TG owner =
   `1318441952`). Refuse from public groups without `allowFrom`.
3. Remind requester this is analyst draft, not publication-ready.

## Execution

```bash
~/.openclaw/workspace/skills/osint/scripts/run.sh "<subject>" "<scope or blank>" "<TG chat id or blank>"
```

The script calls `workflow-orchestrator/scripts/orchestrator.mjs` with
`--workflow osint-triage`. The workflow runs 9 steps across main/gpt/gemini/
claude/water agents, writes the draft to
`~/.openclaw/data/osint-triage/<RUN_TIMESTAMP>-<subject>.md`, and — if a TG
target is supplied — delivers the .md as a Telegram document attachment.

## While It Runs

- Takes 15–30 minutes. Post ONE interim message: `OSINT triage 跑緊，Run ID:
  <id>，估 15–30 分鐘。` so the requester isn't waiting silent.
- Do NOT block the channel waiting — the script backgrounds via orchestrator.

## After It Finishes

If `telegramTarget` was passed, the workflow auto-delivers the .md to TG. If
not, read the deliverable and summarize in-channel:

- Subject, scope, N corroborated claims, N flagged weaknesses, confidence.
- Attach/paste the full `.md` path so the analyst can `cat` it locally.
- Remind: "Draft only — not for publication. Human analyst must verify."

## Hard Reporting Rules

- Never restate claims as facts. Use "sources report…", "alleged…",
  "unverified…".
- Preserve uncertainty. If sources disagree, say so.
- If `self-review` flagged accusation leakage, mention a revision is
  recommended.
