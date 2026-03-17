#!/usr/bin/env node
/**
 * Daily Intelligence Aggregator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI colors
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

class IntelligenceAggregator {
  constructor(options = {}) {
    this.configPath = options.config || path.join(__dirname, 'config.json');
    this.config = this.loadConfig();
    this.items = [];
    this.seenUrls = new Set();
    this.quickMode = options.quick || false;
    this.debug = options.debug || false;
  }

  log(msg, color = RESET) {
    console.log(`${color}${msg}${RESET}`);
  }

  loadConfig() {
    const defaultConfig = {
      sources: {
        rss: [],
        telegram: [],
        slack: []
      },
      tavily: {
        enabled: !this.quickMode,
        max_queries: 5,
        search_depth: 'advanced'
      },
      filter: {
        keywords: [],
        exclude: ['ads', 'promoted', 'sponsored']
      },
      output: {
        format: 'markdown',
        max_items: 20,
        summary_length: 200
      }
    };

    if (fs.existsSync(this.configPath)) {
      try {
        const custom = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return { ...defaultConfig, ...custom, sources: { ...defaultConfig.sources, ...custom.sources } };
      } catch (e) {
        this.log(`Error loading config: ${e.message}`, RED);
      }
    }
    return defaultConfig;
  }

  // Simple HTTP fetch for RSS
  fetchUrl(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  // Parse RSS/Atom
  parseRss(xml) {
    const items = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;

    const parseItem = (match) => {
      const getTag = (tag) => {
        const r = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
        return match.match(r)?.[1] || '';
      };

      return {
        title: getTag('title'),
        url: getTag('link'),
        description: getTag('description') || getTag('summary'),
        pubDate: getTag('pubDate') || getTag('published'),
        source: 'RSS'
      };
    };

    let match;
    const regex = xml.includes('<entry') ? entryRegex : itemRegex;
    while ((match = regex.exec(xml)) !== null) {
      items.push(parseItem(match[1]));
    }

    return items;
  }

  // Filter items by keywords
  filterItems(items) {
    const { keywords, exclude } = this.config.filter;

    return items.filter(item => {
      // Skip duplicates
      if (this.seenUrls.has(item.url)) return false;
      this.seenUrls.add(item.url);

      const text = `${item.title} ${item.description}`.toLowerCase();

      // Check excludes
      for (const word of exclude) {
        if (text.includes(word.toLowerCase())) return false;
      }

      // Check keywords (if any specified)
      if (keywords.length > 0) {
        return keywords.some(k => text.includes(k.toLowerCase()));
      }

      return true; // No keywords = accept all
    });
  }

  // Process RSS sources
  async processRss() {
    const feeds = this.config.sources.rss || [];

    for (const url of feeds) {
      this.log(`Fetching RSS: ${url}`, CYAN);
      try {
        const xml = await this.fetchUrl(url);
        const items = this.parseRss(xml).map(i => ({ ...i, feed: url }));
        this.items.push(...items);
      } catch (e) {
        this.log(`  Error: ${e.message}`, RED);
      }
    }
  }

  // Process Telegram (stub - needs real API)
  async processTelegram() {
    const channels = this.config.sources.telegram || [];
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.log('TELEGRAM_BOT_TOKEN not set, skipping Telegram', YELLOW);
      return;
    }

    for (const cfg of channels) {
      this.log(`Fetching Telegram: ${cfg.channel}`, CYAN);
      // Stub: real implementation would use Telegram Bot API
      this.log('  (Telegram API integration stub)', YELLOW);
    }
  }

  // Process Slack (stub - needs real API)
  async processSlack() {
    const channels = this.config.sources.slack || [];
    const token = process.env.SLACK_BOT_TOKEN;

    if (!token) {
      this.log('SLACK_BOT_TOKEN not set, skipping Slack', YELLOW);
      return;
    }

    for (const cfg of channels) {
      this.log(`Fetching Slack: ${cfg.channel}`, CYAN);
      // Stub: real implementation would use Slack API
      this.log('  (Slack API integration stub)', YELLOW);
    }
  }

  // Tavily research (stub)
  async tavilyResearch(query) {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      this.log('TAVILY_API_KEY not set, skipping deep research', YELLOW);
      return [];
    }

    this.log(`Tavily research: "${query}"`, MAGENTA);
    // Stub: real implementation would call Tavily API
    return [
      { title: 'Research result 1', url: 'https://example.com/1', snippet: 'Key finding...' },
      { title: 'Research result 2', url: 'https://example.com/2', snippet: 'Key finding...' }
    ];
  }

  // Truncate text
  truncate(text, maxLen = 200) {
    if (!text) return '';
    text = text.replace(/<[^>]*>/g, '').trim();
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  // Generate report
  async generateReport() {
    this.log('\nProcessing sources...', CYAN);

    await this.processRss();
    await this.processTelegram();
    await this.processSlack();

    // Filter and sort
    const filtered = this.filterItems(this.items);
    filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Take top items
    const topItems = filtered.slice(0, this.config.output.max_items);

    // Debug mode
    if (this.debug) {
      this.log('\nRaw Items:', MAGENTA);
      topItems.forEach((item, i) => {
        console.log(`${i + 1}. [${item.source}] ${item.title}`);
        console.log(`   ${item.url}`);
      });
      return;
    }

    // Generate markdown
    const today = new Date().toISOString().split('T')[0];
    let report = `# Daily Intelligence Report - ${today}\n\n`;

    // Summary
    const counts = { RSS: 0, Telegram: 0, Slack: 0 };
    topItems.forEach(i => counts[i.source] = (counts[i.source] || 0) + 1);

    report += `## 📊 Summary\n`;
    report += `- **${topItems.length}** items processed\n`;
    Object.entries(counts).forEach(([source, count]) => {
      if (count > 0) report += `- **${count}** from ${source}\n`;
    });

    // Top stories (top 5)
    const topStories = topItems.slice(0, 5);
    report += `\n## 🔥 Top Stories\n\n`;

    topStories.forEach((item, i) => {
      report += `### ${i + 1}. ${item.title}\n`;
      report += `**Source:** ${item.source}`;
      if (item.pubDate) {
        const date = new Date(item.pubDate).toLocaleString();
        report += ` | **Date:** ${date}`;
      }
      report += `\n\n`;
      report += `> ${this.truncate(item.description, 150)}\n\n`;
      if (item.url) report += `[Read more](${item.url})\n\n`;
    });

    // Deep research (if enabled)
    if (this.config.tavily.enabled && topStories.length > 0) {
      report += `## 🔬 Deep Research\n\n`;

      const queries = topStories.slice(0, this.config.tavily.max_queries);
      for (const item of queries) {
        report += `### Topic: ${item.title}\n\n`;

        const results = await this.tavilyResearch(item.title);
        report += `Tavily search results:\n`;
        results.forEach(r => {
          report += `- [${r.title}](${r.url}) - ${this.truncate(r.snippet, 100)}\n`;
        });
        report += `\n`;
      }
    }

    // All items table
    report += `## 📋 All Items\n\n`;
    report += `| Time | Source | Title |\n`;
    report += `|------|--------|-------|\n`;

    topItems.forEach(item => {
      const time = item.pubDate ? new Date(item.pubDate).toLocaleTimeString() : '-';
      const title = this.truncate(item.title, 40);
      report += `| ${time} | ${item.source} | ${title} |\n`;
    });

    // Output
    console.log('\n' + report);

    // Save report
    const reportPath = path.join(__dirname, `reports/daily-${today}.md`);
    fs.mkdirSync(path.dirname(reportPath), { exist_ok: true });
    fs.writeFileSync(reportPath, report);
    this.log(`\nReport saved: ${reportPath}`, GREEN);

    return report;
  }
}

// CLI
const args = process.argv.slice(2);
const options = {
  config: null,
  quick: args.includes('--quick') || args.includes('-q'),
  debug: args.includes('--debug'),
  today: args.includes('--today')
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--config' && args[i + 1]) {
    options.config = args[++i];
  }
}

const aggregator = new IntelligenceAggregator(options);
aggregator.generateReport().catch(e => {
  aggregator.log(`Error: ${e.message}`, RED);
  process.exit(1);
});
