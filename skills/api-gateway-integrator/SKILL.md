---
name: api-gateway-integrator
description: Unified API interface aggregator with rate limiting, caching, and failover. Use when integrating multiple external APIs, implementing rate limits, caching responses, or handling service failover.
version: 1.1.0
metadata:
  changes:
    - "1.1.0: Added OAuth token support for endpoint requests"
---

# API Gateway Integrator

Unified API interface aggregator with rate limiting, caching, and failover capabilities.

## When to Activate

Activate this skill when:
- Integrating multiple external APIs
- Need rate limiting to prevent throttling
- Caching responses to reduce API calls
- Implementing circuit breaker pattern
- Aggregating responses from multiple services

## Core Concepts

### Unified Interface

```javascript
// Instead of multiple API calls:
const user = await fetchUser(id);
const posts = await fetchPosts(user.id);
const comments = await fetchComments(posts.map(p => p.id));

// Use unified gateway:
const data = await gateway.request({
  endpoint: '/user-profile',
  params: { id },
  includes: ['posts', 'comments']
});
```

### Rate Limiting

| Tier | Requests/min | Burst | Cooldown |
|------|--------------|-------|----------|
| Free | 60 | 10 | 1s |
| Standard | 200 | 50 | 500ms |
| Premium | 1000 | 200 | 100ms |

### Circuit Breaker

```
Closed (Normal) → Open (Fail) → Half-Open (Testing)
     ↓              ↓              ↓
  Requests      Block all      Test health
   pass         requests       periodically
```

### Response Caching

- TTL-based expiration
- Stale-while-revalidate
- Cache invalidation patterns

## Usage

### Basic Request

```bash
# Simple API call
node scripts/gateway.mjs --action request --endpoint /users

# With parameters
node scripts/gateway.mjs --action request --endpoint /search --params "q=test&limit=10"
```

### Cache Operations

```bash
# Get cached response
node scripts/gateway.mjs --action cache --key "users:123"

# Invalidate cache
node scripts/gateway.mjs --action invalidate --pattern "users:*"

# Show cache stats
node scripts/gateway.mjs --action cache-stats
```

### Health & Status

```bash
# Check all endpoints
node scripts/gateway.mjs --action health

# Circuit breaker status
node scripts/gateway.mjs --action circuit-status
```

### Rate Limit Info

```bash
# Current rate limit status
node scripts/gateway.mjs --action rate-limit

# Reset rate limit counter
node scripts/gateway.mjs --action rate-limit --reset
```

## Scripts

### gateway.mjs

Main gateway script for all operations.

```bash
node scripts/gateway.mjs --action <action> [options]
```

**Actions:**
- `request` - Make API request through gateway
- `cache` - Cache operations (get/set/invalidate)
- `health` - Health check all endpoints
- `circuit-status` - Show circuit breaker state
- `rate-limit` - Rate limit status and control
- `config` - Update gateway configuration
- `stats` - Show usage statistics

**Options:**
- `--endpoint <path>` - API endpoint path
- `--params <json>` - Query parameters as JSON
- `--method <method>` - HTTP method (GET/POST/PUT/DELETE)
- `--body <json>` - Request body for POST/PUT
- `--key <string>` - Cache key
- `--ttl <seconds>` - Cache TTL
- `--verbose, -v` - Detailed output

## Configuration

### config.json

```json
{
  "endpoints": {
    "users": {
      "baseUrl": "https://api.example.com/users",
      "timeout": 5000,
      "retry": 3,
      "oauthToken": "${OAUTH_TOKEN}",
      "headers": {
        "X-Custom-Header": "value"
      }
    },
    "posts": {
      "baseUrl": "https://api.example.com/posts",
      "timeout": 10000,
      "retry": 2
    }
  },
  "rateLimit": {
    "default": {
      "requestsPerMinute": 60,
      "burst": 10
    }
  },
  "cache": {
    "defaultTTL": 300,
    "maxSize": 1000
  },
  "circuitBreaker": {
    "failureThreshold": 5,
    "resetTimeout": 30000
  }
}
```

### OAuth Support

Configure OAuth tokens per endpoint:

```json
"endpoints": {
  "api": {
    "baseUrl": "https://api.openai.com",
    "oauthToken": "${OAUTH_TOKEN}"
  }
}
```

Or pass via CLI:
```bash
node scripts/gateway.mjs --action request --endpoint /v1/chat/completions --oauth-token "your-token"
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_CONFIG` | Path to config file | `./config.json` |
| `GATEWAY_CACHE_DIR` | Cache directory | `./cache` |
| `GATEWAY_LOG_DIR` | Log directory | `./logs` |

## File Structure

```
api-gateway-integrator/
├── SKILL.md (this file)
├── scripts/
│   └── gateway.mjs           # Main gateway script
├── config/
│   └── default.json          # Default configuration
├── cache/                    # Cache storage (auto-created)
└── logs/                     # Request logs (auto-created)
```

## Integration

### With Other Skills

- **Tavily Search**: Use gateway for rate-limited web search
- **Web Fetch**: Cache web fetch responses
- **Context Manager**: Cache API responses for long sessions

### With External APIs

```javascript
// Example: Aggregating multiple services
const result = await gateway.aggregate({
  sources: [
    { endpoint: 'users', key: 'userData' },
    { endpoint: 'posts', key: 'userPosts' },
    { endpoint: 'analytics', key: 'stats' }
  ],
  timeout: 15000
});
```

## Best Practices

1. **Always set timeouts**: Prevent hanging requests
2. **Use caching**: Reduce API costs and latency
3. **Implement circuit breakers**: Fail fast, recover gracefully
4. **Log requests**: Track usage and debug issues
5. **Monitor rate limits**: Stay within API quotas
6. **Cache invalidation**: Keep data fresh

## Common Workflows

### Web Search via Gateway

```bash
# Search with caching
node scripts/gateway.mjs --action request \
  --endpoint /search \
  --params '{"q":"OpenClaw","limit":5}'

# Cache hit (fast)
node scripts/gateway.mjs --action request \
  --endpoint /search \
  --params '{"q":"OpenClaw"}'
```

### Cache Invalidation After Update

```bash
# After updating user data
node scripts/gateway.mjs --action invalidate --pattern "user:123:*"
```

### Health Check

```bash
# Check all endpoints
node scripts/gateway.mjs --action health
# Output:
# users:      ✅ OK (23ms)
# posts:      ✅ OK (45ms)
# analytics:  ⚠️  SLOW (210ms)
# search:     ❌ FAIL (timeout)
```

## Metrics

Track these metrics:

| Metric | Description | Target |
|--------|-------------|--------|
| Latency | Response time | < 500ms P95 |
| Cache Hit Rate | % of cache hits | > 70% |
| Error Rate | % of failed requests | < 1% |
| Rate Limit | % of rate limits hit | < 5% |

---

## Skill Metadata

**Created**: 2026-02-17
**Author**: Lei Sau
**Version**: 1.0.0
