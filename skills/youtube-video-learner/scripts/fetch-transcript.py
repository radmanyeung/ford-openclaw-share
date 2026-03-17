#!/usr/bin/env python3
"""Fetch YouTube transcript with timestamps. Outputs plain text to stdout.

Usage: python3 fetch-transcript.py <video_url_or_id> [language]
  language: ISO 639-1 code, default "en". Falls back to any available language.

Requires: pip install youtube-transcript-api
"""
import sys
import re

def extract_video_id(url_or_id: str) -> str:
    """Extract video ID from URL or return as-is if already an ID."""
    patterns = [
        r'(?:v=|/v/|youtu\.be/|/embed/|/shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url_or_id)
        if m:
            return m.group(1)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    print(f"ERROR: Cannot extract video ID from: {url_or_id}", file=sys.stderr)
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fetch-transcript.py <video_url_or_id> [language]", file=sys.stderr)
        sys.exit(1)

    video_id = extract_video_id(sys.argv[1])
    lang = sys.argv[2] if len(sys.argv) > 2 else "en"

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        print("ERROR: youtube-transcript-api not installed. Run: pip3 install --user --break-system-packages youtube-transcript-api", file=sys.stderr)
        sys.exit(1)

    api = YouTubeTranscriptApi()

    # Try requested language first
    transcript = None
    try:
        transcript = api.fetch(video_id, languages=[lang])
    except Exception:
        # Fall back to any available language
        try:
            tl = api.list(video_id)
            for t in tl:
                try:
                    transcript = t.fetch()
                    print(f"# Language: {t.language} ({t.language_code})", file=sys.stderr)
                    break
                except Exception:
                    continue
        except Exception as e:
            print(f"ERROR: No transcripts available for {video_id}: {e}", file=sys.stderr)
            sys.exit(1)

    if transcript is None:
        print(f"ERROR: Could not fetch any transcript for {video_id}", file=sys.stderr)
        sys.exit(1)

    for snippet in transcript.snippets:
        mins = int(snippet.start // 60)
        secs = int(snippet.start % 60)
        print(f"[{mins:02d}:{secs:02d}] {snippet.text}")

if __name__ == "__main__":
    main()
