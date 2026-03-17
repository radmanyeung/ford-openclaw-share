#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');

// Load config
const CONFIG_PATH = join(SKILL_ROOT, 'config.json');
let config = {
  tavilyApiKey: process.env.TAVILY_API_KEY || '',
  defaultFormat: 'markdown',
  outputDir: './research/',
  channels: {
    telegram: { enabled: false, chatId: '', token: '' },
    discord: { enabled: false, webhookUrl: '' },
    slack: { enabled: false, webhookUrl: '' }
  }
};

if (existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) {
    console.warn('⚠️ Failed to load config, using defaults');
  }
}

// Ensure output directory exists
if (!existsSync(config.outputDir)) {
  mkdirSync(config.outputDir, { recursive: true });
}

function getTavilyResults(query, maxResults = 10) {
  const fetch = (await import('node-fetch')).default;
  const url = 'https://api.tavily.com/search';
  
  const body = {
    api_key: config.tavilyApiKey,
    query: query,
    max_results: maxResults,
    include_answer: true,
    include_images: false,
    search_depth: 'medium'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.statusText}`);
  }

  return await response.json();
}

function generateMarkdown(results, topic, timestamp) {
  let markdown = `# ${topic}\n\n`;
  markdown += `**生成時間：** ${timestamp}\n\n`;
  markdown += `**來源數量：** ${results.length}\n\n`;
  markdown += `---\n\n`;
  markdown += `## 搜尋結果\n\n`;

  results.forEach((result, index) => {
    markdown += `### ${index + 1}. ${result.title || '無標題'}\n\n`;
    markdown += `- **URL：** [${result.url}](${result.url})\n`;
    markdown += `- **摘要：** ${result.content || result.snippet || '無內容'}\n`;
    markdown += `- **相關度：** ${(result.score * 100 || 0).toFixed(1)}%\n\n`;
  });

  markdown += `\n---\n\n*報告由 automated-report-pipeline 生成*\n`;
  return markdown;
}

function generateJson(results, topic, timestamp) {
  return JSON.stringify({
    topic,
    timestamp,
    sourceCount: results.length,
    sources: results.map(r => ({
      title: r.title,
      url: r.url,
      content: r.content || r.snippet,
      relevanceScore: r.score || 0
    }))
  }, null, 2);
}

async function deliverToChannels(content, format) {
  const { webhookDeliver } = await import('./webhook.mjs');
  
  if (config.channels.telegram.enabled) {
    await webhookDeliver(config.channels.telegram, content, format, 'telegram');
  }
  if (config.channels.discord.enabled) {
    await webhookDeliver(config.channels.discord, content, format, 'discord');
  }
  if (config.channels.slack.enabled) {
    await webhookDeliver(config.channels.slack, content, format, 'slack');
  }
}

async function cmdDaily() {
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toISOString().split('T')[0];
  const topics = [
    'artificial intelligence news today',
    'technology trends 2024',
    'programming and software development'
  ];

  console.log('📊 Generating daily research report...');
  const allResults = [];

  for (const topic of topics) {
    console.log(`  → Searching: ${topic}`);
    try {
      const results = await getTavilyResults(topic, 5);
      allResults.push({ topic, results: results.results || [] });
    } catch (e) {
      console.error(`  ✗ Failed: ${e.message}`);
    }
  }

  const content = allResults.map(r => {
    return `## ${r.topic}\n\n` + 
      (r.results.map(item => `- [${item.title}](${item.url}): ${item.snippet?.substring(0, 150)}...`).join('\n') || 'No results');
  }).join('\n\n---\n\n');

  const filename = `daily-report-${dateStr}`;
  const ext = config.defaultFormat;
  
  if (ext === 'json') {
    const jsonOutput = generateJson(allResults.flatMap(r => r.results), 'Daily Report', timestamp);
    writeFileSync(join(config.outputDir, `${filename}.json`), jsonOutput);
    console.log(`✅ Saved: ${filename}.json`);
  } else {
    const markdownOutput = `# 📊 每日研究報告\n\n**日期：** ${dateStr}\n\n` + content;
    writeFileSync(join(config.outputDir, `${filename}.md`), markdownOutput);
    console.log(`✅ Saved: ${filename}.md`);
  }

  // Deliver to channels
  if (config.channels.telegram?.enabled || config.channels.discord?.enabled) {
    await deliverToChannels(content, ext);
    console.log('📨 Delivered to configured channels');
  }
}

async function cmdTopic(args) {
  const query = args[0];
  if (!query) {
    console.error('❌ Error: topic query required');
    console.log('Usage: report.mjs topic "<query>"');
    process.exit(1);
  }

  console.log(`🔍 Researching: ${query}`);
  const results = await getTavilyResults(query, 10);
  const timestamp = new Date().toISOString();
  const safeFilename = query.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);
  const ext = config.defaultFormat;

  if (ext === 'json') {
    const jsonOutput = generateJson(results.results || [], query, timestamp);
    const outputPath = join(config.outputDir, `topic-${safeFilename}.json`);
    writeFileSync(outputPath, jsonOutput);
    console.log(`✅ Saved: topic-${safeFilename}.json`);
  } else {
    const markdownOutput = generateMarkdown(results.results || [], query, timestamp);
    const outputPath = join(config.outputDir, `topic-${safeFilename}.md`);
    writeFileSync(outputPath, markdownOutput);
    console.log(`✅ Saved: topic-${safeFilename}.md`);
  }

  // Show summary
  console.log(`\n📊 Found ${results.results?.length || 0} sources`);
  (results.results || []).slice(0, 3).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.title?.substring(0, 60)}...`);
  });
}

async function cmdTrigger() {
  const timestamp = new Date().toISOString();
  const lastReport = readdirSync(config.outputDir)
    .filter(f => f.startsWith('daily-report-'))
    .sort()
    .pop();

  if (!lastReport) {
    console.error('❌ No daily report found to trigger');
    process.exit(1);
  }

  const reportPath = join(config.outputDir, lastReport);
  const content = readFileSync(reportPath, 'utf-8');
  const ext = reportPath.endsWith('.json') ? 'json' : 'markdown';

  await deliverToChannels(content, ext);
  console.log(`📨 Triggered delivery of ${lastReport}`);
}

// Parse command
const cmd = process.argv[2] || '';
const args = process.argv.slice(3);

(async () => {
  switch (cmd) {
    case 'daily':
      await cmdDaily();
      break;
    case 'topic':
      await cmdTopic(args);
      break;
    case 'trigger':
      await cmdTrigger();
      break;
    default:
      console.log(`
🤖 automated-report-pipeline

Usage: report.mjs <command> [args]

Commands:
  daily          Generate daily intelligence summary
  topic "<query>"  Research a specific topic
  trigger        Trigger delivery of last report

Options:
  --format json|markdown  Output format (default: markdown)

Examples:
  report.mjs daily
  report.mjs topic "machine learning trends"
  report.mjs topic "AI news" --format json
  report.mjs trigger
`);
  }
})();
