#!/bin/bash
# daily-report.sh - Generate daily research report
# Usage: ./daily-report.sh

cd "$(dirname "$0")"
echo "📊 Generating daily research report..."
node report.mjs daily
