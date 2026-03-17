#!/usr/bin/env node
/**
 * Tavily Research Agent - Deep Research Script
 * 
 * AI-optimized research with structured report generation.
 * Uses Tavily API for high-speed search and content extraction.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env if present
function loadEnv() {
  const envPath = join(__dirname, '..', '..', '..', '..', '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value) {
        const cleanKey = key.trim();
        const cleanValue = value.join('=').trim();
        if (!process.env[cleanKey]) {
          process.env[cleanKey] = cleanValue;
        }
      }
    });
  }
  loadEnvFromUser();
}

function loadEnvFromUser() {
  // Also check user's home directory for .env
  const homeEnvPath = join(process.env.HOME || '', '.env');
  if (existsSync(homeEnvPath)) {
    try {
      const envContent = readFileSync(homeEnvPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value && key.startsWith('TAVILY')) {
          const cleanKey = key.trim();
          const cleanValue = value.join('=').trim();
          if (!process.env[cleanKey]) {
            process.env[cleanKey] = cleanValue;
          }
        }
      });
    } catch (e) {
      // Ignore home .env errors
    }
  }
}

loadEnv();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const API_BASE = 'https://api.tavily.com';

/**
 * Make a request to Tavily API
 */
async function tavilyRequest(endpoint, data) {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY not set. Get one at https://tavily.com');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TAVILY_API_KEY}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Perform search query
 */
async function search(query, options = {}) {
  const {
    maxResults = 10,
    topic = 'general',
    days = 7,
    includeAnswer = true,
    includeRawContent = false,
    includeImages = false
  } = options;

  const data = {
    query,
    max_results: maxResults,
    topic,
    days,
    include_answer: includeAnswer,
    include_raw_content: includeRawContent,
    include_images: includeImages
  };

  return tavilyRequest('/search', data);
}

/**
 * Extract content from URLs
 */
async function extract(urls, options = {}) {
  const { extractContents = true, timeout = 30 } = options;

  const data = {
    urls: Array.isArray(urls) ? urls : [urls],
    extract_contents: extractContents,
    timeout
  };

  return tavilyRequest('/extract', data);
}

/**
 * Perform deep research (iterative query expansion)
 */
async function deepResearch(initialQuery, options = {}) {
  const { maxResults = 10, maxIterations = 3 } = options;
  const verbose = options.verbose || false;

  if (verbose) console.log('\n🔬 Starting deep research...\n');

  // Phase 1: Initial exploration
  const initialResults = await search(initialQuery, { 
    maxResults: maxResults, 
    includeAnswer: true 
  });

  let allFindings = [...(initialResults.results || [])];
  let allSources = [];

  if (verbose) {
    console.log(`📊 Initial search returned ${allFindings.length} results\n`);
  }

  // Collect sources
  allFindings.forEach(r => {
    if (r.url && r.title) {
      allSources.push({ title: r.title, url: r.url, domain: new URL(r.url).hostname });
    }
  });

  // Phase 2: Generate follow-up queries based on findings
  if (allFindings.length > 0) {
    const subtopics = generateFollowUpQueries(initialQuery, allFindings);

    if (verbose) console.log(`🎯 Identified ${subtopics.length} subtopics to explore\n`);

    for (let i = 0; i < Math.min(subtopics.length, maxIterations); i++) {
      const subQuery = subtopics[i];
      if (verbose) console.log(`  → Exploring: ${subQuery}`);

      try {
        const subResults = await search(subQuery, { maxResults: Math.floor(maxResults / 2) });
        allFindings = [...allFindings, ...(subResults.results || [])];

        subResults.results?.forEach(r => {
          if (r.url && r.title) {
            allSources.push({ title: r.title, url: r.url, domain: new URL(r.url).hostname });
          }
        });

        // Rate limiting pause
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        if (verbose) console.log(`    ⚠️ Sub-query failed: ${e.message}`);
      }
    }
  }

  // Remove duplicate sources
  const uniqueSources = [];
  const seenUrls = new Set();
  allSources.forEach(s => {
    if (!seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueSources.push(s);
    }
  });

  return {
    query: initialQuery,
    findings: allFindings,
    sources: uniqueSources,
    depth: 'deep',
    iterations: Math.min(
      1 + Math.ceil(allFindings.length / maxResults), 
      1 + maxIterations
    )
  };
}

/**
 * Generate follow-up queries based on initial results
 */
function generateFollowUpQueries(originalQuery, results) {
  const queries = new Set();
  const domains = new Map();

  // Analyze results to identify themes and gaps
  results.forEach(r => {
    const domain = new URL(r.url).hostname;
    if (!domains.has(domain)) {
      domains.set(domain, []);
    }
    domains.get(domain).push(r.title);
  });

  // Extract entities and concepts (simplified)
  const titleText = results.map(r => r.title).join(' ');
  const words = titleText.toLowerCase().split(/\s+/);
  
  // Simple heuristic: add queries for different angles
  const patterns = [
    `${originalQuery} history`,
    `${originalQuery} latest developments`,
    `${originalQuery} challenges and limitations`,
    `${originalQuery} future outlook`,
    `${originalQuery} comparison`,
    `${originalQuery} implementation`
  ];

  patterns.forEach(q => queries.add(q));
  
  return Array.from(queries).slice(0, 5);
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(data) {
  const { query, findings, sources, depth, answer } = data;
  const timestamp = new Date().toISOString();

  let report = `# Research Report: ${query}\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Depth:** ${depth}\n`;
  report += `**Sources:** ${sources.length}\n\n`;

  report += `---\n\n`;

  // Executive Summary
  report += `## Executive Summary\n\n`;
  
  if (answer) {
    report += `${answer}\n\n`;
  } else if (findings.length > 0) {
    // Generate summary from top findings
    const topFindings = findings.slice(0, 5);
    const summaryPoints = topFindings.map((f, i) => {
      return `${i + 1}. ${f.title}: ${f.content?.substring(0, 150) || 'See source for details'}...`;
    }).join('\n');
    report += `Based on analysis of ${findings.length} sources:\n\n${summaryPoints}\n\n`;
  }

  // Key Findings
  report += `## Key Findings\n\n`;
  if (findings.length > 0) {
    findings.slice(0, 10).forEach((f, i) => {
      report += `### ${i + 1}. ${f.title}\n\n`;
      if (f.content) {
        report += `${f.content.substring(0, 500)}${f.content.length > 500 ? '...' : ''}\n\n`;
      }
      report += `**Source:** [${new URL(f.url).hostname}](${f.url})\n\n`;
    });
  } else {
    report += `No significant findings from search.\n\n`;
  }

  // Detailed Analysis by Theme
  report += `## Thematic Analysis\n\n`;
  
  // Group by domain
  const domainGroups = {};
  sources.forEach(s => {
    const domain = s.domain.replace('www.', '');
    if (!domainGroups[domain]) {
      domainGroups[domain] = [];
    }
    domainGroups[domain].push(s);
  });

  Object.entries(domainGroups).slice(0, 5).forEach(([domain, sourceList]) => {
    report += `### ${domain}\n\n`;
    sourceList.forEach(s => {
      report += `- [${s.title}](${s.url})\n`;
    });
    report += `\n`;
  });

  // Sources
  report += `## Sources\n\n`;
  sources.forEach((s, i) => {
    report += `${i + 1}. [${s.title}](${s.url})\n`;
  });

  report += `\n---\n\n`;
  report += `*Report generated by Tavily Research Agent*\n`;

  return report;
}

/**
 * Generate JSON report
 */
function generateJsonReport(data) {
  return JSON.stringify({
    query: data.query,
    timestamp: new Date().toISOString(),
    depth: data.depth,
    summary: data.answer || null,
    findings: data.findings.map(f => ({
      title: f.title,
      url: f.url,
      content: f.content?.substring(0, 1000),
      domain: new URL(f.url).hostname,
      publishedDate: f.published_date
    })),
    sources: data.sources,
    metadata: {
      totalResults: data.findings.length,
      totalSources: data.sources.length,
      iterations: data.iterations || 1
    }
  }, null, 2);
}

/**
 * Print formatted output
 */
function printOutput(data, format, verbose = false) {
  if (format === 'json') {
    console.log(generateJsonReport(data));
  } else {
    console.log(generateMarkdownReport(data));
  }

  if (verbose) {
    console.log('\n--- VERBOSE METADATA ---\n');
    console.log('Query:', data.query);
    console.log('Depth:', data.depth);
    console.log('Findings:', data.findings.length);
    console.log('Unique Sources:', data.sources.length);
    if (data.iterations) {
      console.log('Research Iterations:', data.iterations);
    }
  }
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse flags
  const flags = {
    query: null,
    maxResults: 10,
    deep: false,
    topic: 'general',
    days: 7,
    sources: [],
    output: 'markdown',
    verbose: false,
    help: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg === '-n' || arg === '--max-results') {
      flags.maxResults = parseInt(args[++i]) || 10;
    } else if (arg === '-d' || arg === '--deep') {
      flags.deep = true;
    } else if (arg === '--topic') {
      flags.topic = args[++i] || 'general';
    } else if (arg === '--days') {
      flags.days = parseInt(args[++i]) || 7;
    } else if (arg === '-s' || arg === '--sources') {
      // Consume all remaining args as URLs
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags.sources.push(args[++i]);
      }
    } else if (arg === '-o' || arg === '--output') {
      flags.output = args[++i] || 'markdown';
    } else if (arg === '--verbose') {
      flags.verbose = true;
    } else if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (!arg.startsWith('-')) {
      flags.query = arg;
    }
    
    i++;
  }

  if (flags.help || !flags.query) {
    console.log(`
🔬 Tavily Research Agent

Usage:
  node research.mjs "research question" [options]
  node research.mjs --sources "url1" "url2" [options]

Options:
  -n, --max-results <n>   Number of results (default: 10, max: 20)
  -d, --deep              Enable deep research mode
  --topic <topic>         "general" or "news" (default: general)
  --days <n>              Days back for news (default: 7)
  -s, --sources <urls>    Extract from specific URLs
  -o, --output <format>   "json" or "markdown" (default: markdown)
  --verbose               Show detailed metadata
  -h, --help              Show this help

Examples:
  node research.mjs "AI impact on healthcare"
  node research.mjs "climate change solutions" --deep --max-results 15
  node research.mjs --topic news --days 3 "Tesla earnings"
  node research.mjs -s "https://example.com/article"
  node research.mjs "machine learning" --output json
`);
    process.exit(flags.help ? 0 : 1);
  }

  try {
    let data;

    if (flags.sources.length > 0) {
      // Extract from specific URLs
      if (flags.verbose) console.log('📄 Extracting from sources...\n');
      const extractResult = await extract(flags.sources);
      
      data = {
        query: flags.query || 'Source Extraction',
        findings: extractResult.results || [],
        sources: flags.sources.map(url => ({
          title: 'Extracted Content',
          url,
          domain: new URL(url).hostname
        })),
        depth: 'source-extraction',
        answer: extractResult.extract_contents?.join('\n\n') || null
      };
    } else if (flags.deep) {
      // Deep research mode
      data = await deepResearch(flags.query, {
        maxResults: flags.maxResults,
        verbose: flags.verbose
      });
    } else {
      // Standard search
      if (flags.verbose) console.log('🔍 Searching...\n');
      const searchResult = await search(flags.query, {
        maxResults: flags.maxResults,
        topic: flags.topic,
        days: flags.days,
        includeAnswer: true
      });

      const sources = (searchResult.results || []).map(r => ({
        title: r.title,
        url: r.url,
        domain: new URL(r.url).hostname
      }));

      data = {
        query: flags.query,
        findings: searchResult.results || [],
        sources,
        depth: 'standard',
        answer: searchResult.answer
      };
    }

    printOutput(data, flags.output, flags.verbose);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
