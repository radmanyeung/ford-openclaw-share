#!/usr/bin/env node
/**
 * Tavily Content Extraction Script
 * 
 * Extract clean text content from URLs using Tavily API.
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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
}
loadEnv();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const API_BASE = 'https://api.tavily.com';

/**
 * Extract content from URLs
 */
async function extract(urls, options = {}) {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY not set. Get one at https://tavily.com');
  }

  const urlsArray = Array.isArray(urls) ? urls : [urls];
  
  const data = {
    urls: urlsArray,
    extract_contents: true,
    timeout: options.timeout || 30
  };

  const response = await fetch(`${API_BASE}/extract`, {
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
 * Format output based on requested format
 */
function formatOutput(result, format, maxLength) {
  const { results } = result;
  
  if (!results || results.length === 0) {
    return 'No content extracted.';
  }

  if (format === 'json') {
    const json = {
      timestamp: new Date().toISOString(),
      extracted: results.map(r => ({
        url: r.url,
        title: r.title,
        content: r.content?.substring(0, maxLength),
        raw_content: r.raw_content?.substring(0, maxLength),
        metadata: {
          links_found: r.links_found?.length || 0,
          images_found: r.images_found?.length || 0
        }
      }))
    };
    return JSON.stringify(json, null, 2);
  }

  if (format === 'text') {
    return results.map(r => {
      return `=== ${r.url} ===\n\n${r.content?.substring(0, maxLength) || ''}\n`;
    }).join('\n---\n\n');
  }

  // Default: Markdown
  return results.map(r => {
    return `## ${r.title || r.url}\n\n**URL:** ${r.url}\n\n${r.content?.substring(0, maxLength) || ''}\n`;
  }).join('\n---\n\n');
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    urls: [],
    format: 'markdown',
    maxLength: 10000,
    verbose: false,
    help: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg === '--format') {
      options.format = args[++i] || 'markdown';
    } else if (arg === '--max-length') {
      options.maxLength = parseInt(args[++i]) || 10000;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      options.urls.push(arg);
    }
    
    i++;
  }

  if (options.help || options.urls.length === 0) {
    console.log(`
📄 Tavily Content Extractor

Usage:
  node extract.mjs "https://example.com/article" [options]
  node extract.mjs "url1" "url2" "url3" [options]

Options:
  --format <format>    "json", "markdown", or "text" (default: markdown)
  --max-length <n>    Maximum characters to extract (default: 10000)
  --verbose           Show extraction metadata
  -h, --help          Show this help

Examples:
  node extract.mjs "https://example.com/article"
  node extract.mjs "https://site.com/page1" "https://site.com/page2" --format json
  node extract.mjs "https://blog.post" --max-length 5000 --format text
`);
    process.exit(options.help ? 0 : 1);
  }

  try {
    console.log('📄 Extracting content...\n');
    
    const result = await extract(options.urls, { timeout: 30 });
    const output = formatOutput(result, options.format, options.maxLength);
    
    console.log(output);

    if (options.verbose) {
      console.log('\n--- EXTRACTION METADATA ---\n');
      result.results?.forEach(r => {
        console.log(`URL: ${r.url}`);
        console.log(`  Title: ${r.title || 'N/A'}`);
        console.log(`  Content length: ${r.content?.length || 0}`);
        console.log(`  Links found: ${r.links_found?.length || 0}`);
        console.log(`  Images found: ${r.images_found?.length || 0}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
