#!/bin/bash
# trigger-report.sh - Trigger delivery of last report
# Usage: ./trigger-report.sh

cd "$(dirname "$0")"
echo "📨 Triggering report delivery..."
node report.mjs trigger
