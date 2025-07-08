# Performance Monitoring and Optimization Guide

This document describes the performance monitoring and optimization features added to the StockAlert Slack App.

## Overview

The application now includes comprehensive performance monitoring, caching, and optimization capabilities:

1. **Application Monitoring** - Real-time metrics collection and performance tracking
2. **Caching Layer** - Multi-tier caching for frequently accessed data
3. **Performance Testing** - Load testing tools for capacity planning
4. **Enhanced Health Checks** - Detailed health status with metrics

## Monitoring Features

### Metrics Collection

The monitoring system automatically tracks:

- **Request Metrics**
  - Total requests by endpoint
  - Response times (p50, p90, p95, p99)
  - Success/failure rates
  - Error types and frequencies

- **Webhook Processing**
  - Signature verification time
  - Database query performance
  - Slack API posting time
  - End-to-end processing time

- **System Metrics**
  - Memory usage (heap, RSS)
  - CPU utilization
  - Event loop lag

### Usage

Metrics are automatically collected. To view them:

```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed health check with metrics
curl http://localhost:3000/api/health?detailed=true
```

### Performance Decorators

Use the `@monitored` decorator to track any async function:

```typescript
import { monitored } from './lib/monitoring';

class MyService {
  @monitored('myOperation')
  async performOperation() {
    // Your code here
  }
}
```

## Caching System

### Features

- **Two-tier caching**: In-memory (fast) + Redis/KV (persistent)
- **Automatic cache warming**
- **TTL-based expiration**
- **Cache statistics tracking**

### Usage

```typescript
import { Cache, cached } from './lib/cache';

// Get cache instance
const cache = Cache.getInstance();

// Basic operations
await cache.set('key', value, { ttl: 300 }); // 5 minutes
const value = await cache.get('key');

// Get-or-set pattern
const data = await cache.getOrSet(
  'key',
  async () => {
    // Expensive operation
    return await fetchData();
  },
  { ttl: 600 }
);

// Using decorators
class MyService {
  @cached({ ttl: 300, namespace: 'myservice' })
  async getData(id: string) {
    // This will be cached automatically
    return await db.query(id);
  }
}
```

### Specialized Caches

Pre-configured caches for common use cases:

```typescript
import { channelCache, installationCache } from './lib/cache';

// Channel caching
await channelCache.setChannel(teamId, channelId, channelData);
const channel = await channelCache.getChannel(teamId, channelId);

// Installation caching
await installationCache.setInstallation(teamId, installation);
const installation = await installationCache.getInstallation(teamId);
```

## Performance Testing

### Running Performance Tests

```bash
# Basic load test (30 seconds, 10 concurrent)
npm run test:performance

# Custom configuration
TEST_BASE_URL=https://your-app.vercel.app \
CONCURRENCY=50 \
DURATION=60 \
RPS=100 \
npm run test:performance
```

### Test Configuration

- `TEST_BASE_URL`: Target URL (default: http://localhost:3000)
- `CONCURRENCY`: Number of concurrent workers
- `DURATION`: Test duration in seconds
- `RPS`: Requests per second limit (optional)

### Test Output

The performance test provides:

- Request success/failure rates
- Latency percentiles (p50, p90, p95, p99)
- Requests per second
- Error distribution

## Optimizations Implemented

### 1. Webhook Processing

- **Caching**: Installation and channel data cached to reduce DB queries
- **Performance tracking**: Each step is monitored for bottleneck identification
- **Parallel operations**: Where possible, operations run concurrently

### 2. Database Queries

- **Connection pooling**: Reuse database connections
- **Query optimization**: Indexes on frequently queried fields
- **Caching layer**: Reduce repeated queries

### 3. Slack API Calls

- **Token caching**: Avoid repeated token lookups
- **Client reuse**: WebClient instances are reused
- **Error tracking**: Detailed error metrics for debugging

## Monitoring Best Practices

### 1. Regular Health Checks

Set up external monitoring to regularly check:

```bash
curl -f https://your-app.vercel.app/api/health || alert
```

### 2. Performance Baselines

Establish performance baselines:

- Run performance tests after deployments
- Monitor trends over time
- Set alerts for degradation

### 3. Cache Warming

For optimal performance, warm caches on startup:

```typescript
await cache.warmup([
  { key: 'config', value: await loadConfig() },
  { key: 'channels', value: await loadChannels() },
]);
```

### 4. Metric Analysis

Regular review metrics for:

- Unusual error patterns
- Performance degradation
- Capacity planning needs

## Troubleshooting

### High Memory Usage

1. Check cache size: `cache.getStats()`
2. Review memory metrics in health check
3. Adjust cache TTLs if needed

### Slow Response Times

1. Enable detailed health check
2. Review performance metrics by operation
3. Check for missing cache hits
4. Verify database connection health

### Cache Issues

1. Check Redis/KV connectivity
2. Verify cache key patterns
3. Monitor cache hit/miss ratios
4. Review cache expiration settings

## Future Improvements

Consider implementing:

- Distributed tracing (OpenTelemetry)
- Custom dashboards (Grafana)
- Alerting rules (PagerDuty)
- A/B testing for performance changes
