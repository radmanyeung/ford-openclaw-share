#!/bin/bash
# topic-report.sh - Research a specific topic
# Usage: ./topic-report.sh "<query>"

cd "$(dirname "$0")"

if [ -z "$1" ]; then
  echo "Usage: ./topic-report.sh \"<query>\""
  exit 1
fi

echo "🔍 Researching: $1"
node report.mjs topic "$1"
