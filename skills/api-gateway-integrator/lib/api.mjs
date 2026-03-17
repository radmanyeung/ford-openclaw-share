#!/usr/bin/env node
/**
 * Core API Request Handler
 * 
 * Unified interface for all API requests with:
 * - Retry logic
 * - Caching
 * - Rate limiting
 * - Error handling
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const CACHE_DIR = process.env.API_CACHE_DIR || join(__dirname, '..', '..', '..', 'tmp', 'api-cache');
const DEFAULT_TIMEOUT = 30000;

// Cache wrapper
async function withCache(options, fetchFn) {
  if (!options.cache || !options.cache.ttl) {
    return fetchFn();
  }
  
  const cacheKey = options.cache.key || hashKey(options);
  const cacheFile = join(CACHE_DIR, `${cacheKey}.json`);
  
  // Check cache
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
    const age = Date.now() - cached.timestamp;
    
    if (age < options.cache.ttl * 1000) {
      console.log(`[CACHE HIT] ${cacheKey}`);
      return cached.data;
    }
    
    // Stale while revalidate
    if (options.cache.stale) {
      console.log(`[CACHE STALE] ${cacheKey}, returning stale while revalidating`);
      setImmediate(() => refreshCache(cacheFile, fetchFn, cacheKey));
      return cached.data;
    }
  }
  
  // Fetch and cache
  console.log(`[CACHE MISS] ${cacheKey}`);
  return refreshCache(cacheFile, fetchFn, cacheKey);
}

async function refreshCache(cacheFile, fetchFn, key) {
  const data = await fetchFn();
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify({ timestamp: Date.now(), key, data }));
  return data;
}

function hashKey(options) {
  const str = JSON.stringify({
    endpoint: options.endpoint,
    method: options.method,
    body: options.body,
    params: options.params
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Rate limiter
const rateLimits = new Map();

async function checkRateLimit(provider) {
  const now = Date.now();
  const limit = rateLimits.get(provider) || { requests: [], limit: 60 };
  
  // Remove old requests (older than 1 minute)
  limit.requests = limit.requests.filter(t => now - t < 60000);
  
  if (limit.requests.length >= limit.limit) {
    const oldest = limit.requests[0];
    const wait = 60000 - (now - oldest);
    console.log(`[RATE LIMIT] ${provider}, waiting ${wait}ms`);
    await new Promise(r => setTimeout(r, wait));
    return checkRateLimit(provider); // Check again
  }
  
  limit.requests.push(now);
  rateLimits.set(provider, limit);
}

// Retry logic
async function withRetry(fn, retries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable = error.status >= 500 || error.code === 'ECONNRESET';
      
      if (!isRetryable || i === retries - 1) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`[RETRY] ${i + 1}/${retries} after ${delay}ms: ${error.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError;
}

// Main API request function
export async function apiRequest(options) {
  const {
    endpoint,
    method = 'GET',
    body,
    params,
    auth = 'none',
    credentials = {},
    provider = 'default',
    retries = 3,
    timeout = DEFAULT_TIMEOUT,
    cache,
    raw = false,
    validate
  } = options;
  
  return withRetry(async () => {
    // Check rate limit
    await checkRateLimit(provider);
    
    // Build URL
    const baseUrl = process.env[`${provider.toUpperCase()}_API_URL`] || '';
    const url = new URL(endpoint, baseUrl || 'https://api.example.com');
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    }
    
    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(auth, credentials),
      ...options.headers
    };
    
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Parse response
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      // Check for errors
      if (!response.ok) {
        const error = new Error(data.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      
      // Validate response
      if (validate) {
        const { default: validateFn } = await import('ajv');
        const validateFn = new (await import('ajv')).default();
        if (!validateFn.validate(validate, data)) {
          throw new Error(`Validation failed: ${JSON.stringify(validateFn.errors)}`);
        }
      }
      
      return raw ? { status: response.status, data, headers: Object.fromEntries(response.headers) } : data;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }, retries);
}

// Get authentication headers
function getAuthHeaders(type, credentials) {
  switch (type) {
    case 'bearer':
      return { 'Authorization': `Bearer ${credentials.token}` };
    case 'basic':
      const { username, password } = credentials;
      const b64 = Buffer.from(`${username}:${password}`).toString('base64');
      return { 'Authorization': `Basic ${b64}` };
    case 'apikey':
      return { [credentials.header || 'X-API-Key']: credentials.apiKey };
    case 'oauth2':
      return { 'Authorization': `Bearer ${credentials.accessToken}` };
    default:
      return {};
  }
}

// Batch requests
export async function batchRequests(requests, options = {}) {
  const { concurrency = 5 } = options;
  const results = [];
  const running = new Set();
  
  for (const req of requests) {
    const promise = apiRequest(req).then(r => results.push({ req, result: r }));
    running.add(promise);
    
    if (running.size >= concurrency) {
      await Promise.race(running);
      running.delete(promise);
    }
  }
  
  await Promise.all(running);
  return results;
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  
  const endpoint = getArg('--endpoint');
  const method = getArg('--method') || 'GET';
  const bodyStr = getArg('--body');
  
  if (!endpoint) {
    console.error('Usage: node api.mjs --endpoint <url> [--method GET|POST] [--body \'{}\']');
    process.exit(1);
  }
  
  const body = bodyStr ? JSON.parse(bodyStr) : undefined;
  
  apiRequest({ endpoint, method, body })
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
}
