#!/usr/bin/env node
/**
 * Tavily Search with Caching
 * Caches results to reduce API calls and improve response time
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '.cache');
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour default

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

function getCacheKey(query, options) {
  // Simple hash: query + options sorted
  const str = JSON.stringify({ query, ...options });
  return str.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64);
}

function getCached(key, maxAgeMs = CACHE_TTL_MS) {
  const file = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    const age = Date.now() - data.timestamp;
    if (age > maxAgeMs) {
      return null; // Expired
    }
    return data.results;
  } catch {
    return null;
  }
}

function setCache(key, results) {
  const file = join(CACHE_DIR, `${key}.json`);
  try {
    writeFileSync(file, JSON.stringify({ timestamp: Date.now(), results }), 'utf-8');
  } catch (e) {
    // Ignore cache write errors
  }
}

function usage() {
  console.error(`Usage: search.mjs "query" [-n 5] [--deep] [--topic general|news] [--days 7] [--no-cache] [--cache-ttl 3600]`);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "-h" || args[0] === "--help") usage();

const query = args[0];
let n = 5;
let searchDepth = "basic";
let topic = "general";
let days = null;
let useCache = true;
let cacheTtl = CACHE_TTL_MS;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "-n") {
    n = Number.parseInt(args[i + 1] ?? "5", 10);
    i++;
    continue;
  }
  if (a === "--deep") {
    searchDepth = "advanced";
    continue;
  }
  if (a === "--topic") {
    topic = args[i + 1] ?? "general";
    i++;
    continue;
  }
  if (a === "--days") {
    days = Number.parseInt(args[i + 1] ?? "7", 10);
    i++;
    continue;
  }
  if (a === "--no-cache") {
    useCache = false;
    continue;
  }
  if (a === "--cache-ttl") {
    cacheTtl = Number.parseInt(args[i + 1] ?? "3600", 10) * 1000;
    i++;
    continue;
  }
  console.error(`Unknown arg: ${a}`);
  usage();
}

const apiKey = (process.env.TAVILY_API_KEY ?? "").trim();
if (!apiKey) {
  console.error("Missing TAVILY_API_KEY");
  process.exit(1);
}

// Check cache first
const cacheKey = getCacheKey(query, { n, searchDepth, topic, days });
if (useCache) {
  const cached = getCached(cacheKey, cacheTtl);
  if (cached) {
    console.log("[Cache hit]\n");
    printResults(cached, n);
    process.exit(0);
  }
}

const body = {
  api_key: apiKey,
  query: query,
  search_depth: searchDepth,
  topic: topic,
  max_results: Math.max(1, Math.min(n, 20)),
  include_answer: true,
  include_raw_content: false,
};

if (topic === "news" && days) {
  body.days = days;
}

const resp = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!resp.ok) {
  const text = await resp.text().catch(() => "");
  throw new Error(`Tavily Search failed (${resp.status}): ${text}`);
}

const data = await resp.json();

// Cache results
if (useCache && data.results) {
  setCache(cacheKey, data.results);
}

// Print AI-generated answer if available
if (data.answer) {
  console.log("## Answer\n");
  console.log(data.answer);
  console.log("\n---\n");
}

// Print results
printResults(data.results ?? [], n);

function printResults(results, limit) {
  console.log("## Sources\n");
  const resultsSlice = results.slice(0, limit);
  
  for (const r of resultsSlice) {
    const title = String(r?.title ?? "").trim();
    const url = String(r?.url ?? "").trim();
    const content = String(r?.content ?? "").trim();
    const score = r?.score ? ` (relevance: ${(r.score * 100).toFixed(0)}%)` : "";
    
    if (!title || !url) continue;
    console.log(`- **${title}**${score}`);
    console.log(`  ${url}`);
    if (content) {
      console.log(`  ${content.slice(0, 300)}${content.length > 300 ? "..." : ""}`);
    }
    console.log();
  }
}
