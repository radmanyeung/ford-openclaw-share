---
name: youtube-video-learner
description: Learn from YouTube videos by fetching transcripts, translating, and performing structured analysis (core capabilities, required tools, environment gap analysis, suggested setup steps). Use when a user shares a YouTube video URL and wants to learn its content, set up the demonstrated environment, or follow along with a tutorial. Triggers on phrases like "learn this video", "analyse this video", "help me follow this tutorial", or when a YouTube URL is provided with learning/setup intent.
---

# YouTube Video Learner

Extract, translate, and analyse YouTube video content, then help the user bridge the gap between what the video teaches and their current environment.

## Workflow

### 1. Fetch Transcript

Run the bundled script to get timestamped transcript:

```bash
python3 scripts/fetch-transcript.py "<video_url>" [language]
```

- Default language: `en`. Falls back to any available language.
- **Dependency**: `youtube-transcript-api` (install: `pip3 install --user --break-system-packages youtube-transcript-api`)
- If fetch fails (bot detection, no captions), try alternative extraction via Jina Reader API or page scraping before giving up.

### 2. Translate & Summarise

- Translate the full transcript into the user's preferred language (check USER.md).
- Produce a concise summary capturing all key points, not a line-by-line translation.

### 3. Structured Analysis

Follow the template in [references/prompt-template.md](references/prompt-template.md) to produce:

- **A. Core Capabilities** — 3–5 concrete "after watching, you can..." items
- **B. Required Tools & Platforms** — everything mentioned in the video
- **C. Environment Gap Analysis** — scan user's system, compare with B, report ✅/❌
- **D. Suggested Setup Steps** — shortest path to close the gaps

### 4. Present & Wait

Show the full analysis and **ask for confirmation** before executing any setup steps. Pause at each step requiring manual user action.

## Notes

- For long videos (>15 min), summarise in sections with timestamps rather than one massive block.
- Never expose API keys or secrets during environment scanning — only confirm presence/absence.
- If the video is a coding tutorial, identify the specific repo/branch/commit if mentioned.
