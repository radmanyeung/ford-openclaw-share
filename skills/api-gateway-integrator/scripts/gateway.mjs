#!/usr/bin/env node
/**
 * gateway.mjs - API Gateway Integrator
 * 
 * Usage:
 *   node scripts/gateway.mjs --action <action> [options]
 * 
 * Actions:
 *   request       - Make API request through gateway
 *   cache         - Cache operations (get/set/invalidate)
 *   health        - Health check all endpoints
 *   circuit-status - Show circuit breaker state
 *   rate-limit    - Rate limit status and control
 *   config        - Update gateway configuration
 *   stats         - Show usage statistics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure directories exist
[CACHE_DIR, LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    action: null,
    endpoint: null,
    params: null,
    method: 'GET',
    body: null,
    key: null,
    ttl: 300,
    reset: false,
    verbose: false,
    pattern: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--action' && args[i + 1]) config.action = args[++i];
    else if (arg === '--endpoint' && args[i + 1]) config.endpoint = args[++i];
    else if (arg === '--params' && args[i + 1]) config.params = JSON.parse(args[++i]);
    else if (arg === '--method' && args[i + 1]) config.method = args[++i];
    else if (arg === '--body' && args[i + 1]) config.body = JSON.parse(args[++i]);
    else if (arg === '--key' && args[i + 1]) config.key = args[++i];
    else if (arg === '--ttl' && args[i + 1]) config.ttl = parseInt(args[++i]);
    else if (arg === '--reset') config.reset = true;
    else if (arg === '--verbose' || arg === '-v') config.verbose = true;
    else if (arg === '--pattern' && args[i + 1]) config.pattern = args[++i];
    else if (arg === '--oauth-token' && args[i + 1]) config.oauthToken = args[++i];
  }
  
  return config;
}

/**
 * Load gateway configuration
 */
function loadConfig() {
  const configPath = path.join(CONFIG_DIR, 'default.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return { endpoints: {}, rateLimit: {}, cache: {}, circuitBreaker: {} };
}

/**
 * Load endpoint-specific config (for OAuth, baseUrl, etc.)
 */
function loadEndpointConfig(endpoint) {
  const gatewayConfig = loadConfig();
  // Match endpoint prefix to config
  for (const [key, val] of Object.entries(config.endpoints || {})) {
    if (endpoint.startsWith(key)) {
      return val;
    }
  }
  return null;
}

/**
 * Load rate limit state
 */
function loadRateLimits() {
  const statePath = path.join(CACHE_DIR, 'rate-limits.json');
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  return {};
}

/**
 * Save rate limit state
 */
function saveRateLimits(state) {
  const statePath = path.join(CACHE_DIR, 'rate-limits.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Load circuit breaker state
 */
function loadCircuitBreakers() {
  const statePath = path.join(CACHE_DIR, 'circuit-breakers.json');
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  return {};
}

/**
 * Save circuit breaker state
 */
function saveCircuitBreakers(state) {
  const statePath = path.join(CACHE_DIR, 'circuit-breakers.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Get cache key
 */
function getCacheKey(endpoint, params) {
  const data = JSON.stringify({ endpoint, params });
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Check rate limit for an endpoint
 */
function checkRateLimit(endpoint) {
  const gatewayConfig = loadConfig();
  const limits = loadRateLimits();
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  
  const endpointLimit = config.rateLimit[endpoint] || config.rateLimit.default;
  const key = `${endpoint}:${minute}`;
  
  if (!limits[key]) {
    limits[key] = { count: 0, minute };
  }
  
  const remaining = endpointLimit.requestsPerMinute - limits[key].count;
  const resetIn = 60000 - (now % 60000);
  
  return {
    allowed: remaining > 0,
    remaining,
    resetIn: Math.ceil(resetIn / 1000)
  };
}

/**
 * Increment rate limit counter
 */
function incrementRateLimit(endpoint) {
  const limits = loadRateLimits();
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  
  const key = `${endpoint}:${minute}`;
  if (!limits[key]) {
    limits[key] = { count: 0, minute };
  }
  limits[key].count++;
  
  saveRateLimits(limits);
}

/**
 * Check circuit breaker status
 */
function getCircuitStatus(endpoint) {
  const breakers = loadCircuitBreakers();
  const gatewayConfig = loadConfig();
  const breakerConfig = config.circuitBreaker;
  
  if (!breakers[endpoint]) {
    return { state: 'closed', failures: 0 };
  }
  
  const now = Date.now();
  const breaker = breakers[endpoint];
  
  if (breaker.state === 'open') {
    if (now - breaker.lastFailure > breakerConfig.resetTimeout) {
      return { state: 'half-open', failures: breaker.failures };
    }
    return { state: 'open', failures: breaker.failures };
  }
  
  return { state: 'closed', failures: breaker.failures };
}

/**
 * Record circuit breaker failure
 */
function recordFailure(endpoint) {
  const breakers = loadCircuitBreakers();
  const gatewayConfig = loadConfig();
  const breakerConfig = config.circuitBreaker;
  
  if (!breakers[endpoint]) {
    breakers[endpoint] = { state: 'closed', failures: 0, lastFailure: 0 };
  }
  
  breakers[endpoint].failures++;
  breakers[endpoint].lastFailure = Date.now();
  
  if (breakers[endpoint].failures >= breakerConfig.failureThreshold) {
    breakers[endpoint].state = 'open';
  }
  
  saveCircuitBreakers(breakers);
}

/**
 * Record circuit breaker success
 */
function recordSuccess(endpoint) {
  const breakers = loadCircuitBreakers();
  
  if (breakers[endpoint]) {
    breakers[endpoint].state = 'closed';
    breakers[endpoint].failures = 0;
    breakers[endpoint].lastFailure = 0;
  }
  
  saveCircuitBreakers(breakers);
}

/**
 * Action: request - Make API request through gateway
 */
async function actionRequest(config) {
  if (!config.endpoint) {
    console.error('❌ --endpoint <path> required');
    return;
  }
  
  // Check rate limit
  const rateStatus = checkRateLimit(config.endpoint);
  if (!rateStatus.allowed) {
    console.log(`❌ Rate limit exceeded for ${config.endpoint}`);
    console.log(`   Resets in ${rateStatus.resetIn}s`);
    return;
  }
  
  // Check circuit breaker
  const circuit = getCircuitStatus(config.endpoint);
  if (circuit.state === 'open') {
    console.log(`❌ Circuit breaker OPEN for ${config.endpoint}`);
    console.log(`   Wait ${rateStatus.resetIn}s and retry`);
    return;
  }
  
  console.log(`🌐 Request: ${config.method} ${config.endpoint}`);
  console.log(`   Rate limit: ${rateStatus.remaining} remaining`);
  
  // Load endpoint config
  const endpointConfig = loadEndpointConfig(config.endpoint);
  
  // Build request headers
  const headers = {
    'Content-Type': 'application/json',
    ...(endpointConfig?.headers || {})
  };
  
  // Add OAuth token if configured
  if (endpointConfig?.oauthToken) {
    headers['Authorization'] = `Bearer ${endpointConfig.oauthToken}`;
    console.log(`   🔐 Using OAuth token`);
  }
  
  // Make actual HTTP request (if baseUrl configured)
  let response;
  if (endpointConfig?.baseUrl) {
    try {
      const url = `${endpointConfig.baseUrl}${config.endpoint}`;
      const fetchOptions = {
        method: config.method,
        headers,
        signal: AbortSignal.timeout(endpointConfig.timeout || 10000)
      };
      
      if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
        fetchOptions.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
      }
      
      const res = await fetch(url, fetchOptions);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      
      response = {
        endpoint: config.endpoint,
        method: config.method,
        timestamp: new Date().toISOString(),
        status: res.status,
        data
      };
      
      console.log(`✅ Response: ${res.status} ${res.ok ? 'OK' : 'FAIL'}`);
    } catch (err) {
      console.log(`❌ Request failed: ${err.message}`);
      recordFailure(config.endpoint);
      return;
    }
  } else {
    // Simulate request (no baseUrl configured)
    incrementRateLimit(config.endpoint);
    response = {
      endpoint: config.endpoint,
      method: config.method,
      timestamp: new Date().toISOString(),
      status: 200,
      data: { message: 'Response from ' + config.endpoint }
    };
    console.log(`✅ Response: 200 OK (simulated)`);
    recordSuccess(config.endpoint);
  }
  
  console.log(JSON.stringify(response, null, 2));
}

/**
 * Action: cache - Cache operations
 */
function actionCache(config) {
  if (!config.key) {
    // List cache entries
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json') && f !== 'rate-limits.json' && f !== 'circuit-breakers.json');
    console.log(`📦 Cache (${files.length} entries):`);
    files.forEach(f => {
      const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
      const age = Math.floor((Date.now() - data.cached) / 1000);
      console.log(`   ${f.replace('.json', '')}: ${age}s ago (TTL: ${data.ttl}s)`);
    });
    return;
  }
  
  const cachePath = path.join(CACHE_DIR, `${config.key}.json`);
  
  if (config.reset) {
    // Delete cache entry
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      console.log(`✅ Cache deleted: ${config.key}`);
    } else {
      console.log(`❌ Cache not found: ${config.key}`);
    }
  } else {
    // Get cache entry
    if (fs.existsSync(cachePath)) {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const age = Math.floor((Date.now() - data.cached) / 1000);
      console.log(`📦 Cached: ${config.key}`);
      console.log(`   Age: ${age}s / TTL: ${data.ttl}s`);
      console.log(JSON.stringify(data.content, null, 2));
    } else {
      console.log(`❌ Cache miss: ${config.key}`);
    }
  }
}

/**
 * Action: health - Health check all endpoints
 */
async function actionHealth() {
  const gatewayConfig = loadConfig();
  const endpoints = Object.keys(config.endpoints);
  
  console.log(`🏥 Health Check\n`);
  
  for (const endpoint of endpoints) {
    const circuit = getCircuitStatus(endpoint);
    const status = circuit.state === 'closed' ? '✅' : circuit.state === 'half-open' ? '⚠️' : '❌';
    console.log(`${status} ${endpoint.padEnd(15)} ${circuit.state.toUpperCase()} (${circuit.failures} failures)`);
  }
}

/**
 * Action: circuit-status - Show circuit breaker state
 */
function actionCircuitStatus() {
  const gatewayConfig = loadConfig();
  const endpoints = Object.keys(config.endpoints);
  const breakers = loadCircuitBreakers();
  
  console.log(`🔌 Circuit Breakers\n`);
  console.log('Endpoint'.padEnd(15) + 'State'.padEnd(12) + 'Failures');
  console.log('-'.repeat(45));
  
  for (const endpoint of endpoints) {
    const circuit = getCircuitStatus(endpoint);
    const status = circuit.state === 'closed' ? '✅' : circuit.state === 'half-open' ? '⚠️' : '❌';
    console.log(`${endpoint.padEnd(15)} ${status} ${circuit.state.toUpperCase().padEnd(10)} ${circuit.failures}`);
  }
}

/**
 * Action: rate-limit - Rate limit status and control
 */
function actionRateLimit(config) {
  const gatewayConfig = loadConfig();
  const limits = loadRateLimits();
  
  console.log(`⏱️  Rate Limits\n`);
  
  for (const [name, limit] of Object.entries(gatewayConfig.rateLimit)) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${name}:${minute}`;
    const used = limits[key]?.count || 0;
    const remaining = limit.requestsPerMinute - used;
    const pct = (used / limit.requestsPerMinute * 100).toFixed(0);
    
    console.log(`${name}:`);
    console.log(`   ${used}/${limit.requestsPerMinute} used (${pct}%)`);
    console.log(`   ${remaining} remaining`);
    console.log('');
  }
  
  if (config.reset) {
    const statePath = path.join(CACHE_DIR, 'rate-limits.json');
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
      console.log('✅ Rate limits reset');
    }
  }
}

/**
 * Action: config - Update gateway configuration
 */
function actionConfig(config) {
  const configPath = path.join(CONFIG_DIR, 'default.json');
  const current = loadConfig();
  
  console.log(`⚙️  Gateway Configuration\n`);
  console.log(JSON.stringify(current, null, 2));
}

/**
 * Action: stats - Show usage statistics
 */
function actionStats() {
  const cacheFiles = fs.readdirSync(CACHE_DIR).length;
  const rateLimits = loadRateLimits();
  const breakers = loadCircuitBreakers();
  
  console.log(`📊 Gateway Statistics\n`);
  console.log(`Cache entries: ${cacheFiles}`);
  console.log(`Active rate limits: ${Object.keys(rateLimits).length}`);
  console.log(`Circuit breakers: ${Object.keys(breakers).length}`);
}

/**
 * Main execution
 */
async function main() {
  const config = parseArgs();
  
  if (!config.action) {
    console.log(`
🌐 API Gateway Integrator

Usage:
  node scripts/gateway.mjs --action <action> [options]

Actions:
  request        Make API request through gateway
  cache          Cache operations (--key <id> | --reset)
  health         Health check all endpoints
  circuit-status Show circuit breaker state
  rate-limit     Rate limit status (--reset to clear)
  config         Show gateway configuration
  stats          Show usage statistics

Options:
  --endpoint <path>  API endpoint path
  --params <json>    Query parameters as JSON
  --method <method>  HTTP method (GET/POST/PUT/DELETE)
  --body <json>      Request body for POST/PUT
  --key <string>     Cache key
  --ttl <seconds>    Cache TTL
  --reset            Reset/delete operation
  --verbose, -v      Detailed output

Examples:
  node scripts/gateway.mjs --action health
  node scripts/gateway.mjs --action request --endpoint /users
  node scripts/gateway.mjs --action cache --key abc123
  node scripts/gateway.mjs --action circuit-status
`);
    process.exit(0);
  }
  
  switch (config.action) {
    case 'request':
      await actionRequest(config);
      break;
    case 'cache':
      actionCache(config);
      break;
    case 'health':
      await actionHealth();
      break;
    case 'circuit-status':
      actionCircuitStatus();
      break;
    case 'rate-limit':
      actionRateLimit(config);
      break;
    case 'config':
      actionConfig(config);
      break;
    case 'stats':
      actionStats();
      break;
    default:
      console.error(`❌ Unknown action: ${config.action}`);
      process.exit(1);
  }
}

main();
