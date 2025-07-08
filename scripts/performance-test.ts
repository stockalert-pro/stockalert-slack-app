#!/usr/bin/env tsx

import { performance } from 'perf_hooks';

interface TestResult {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  requestsPerSecond: number;
  errors: Record<string, number>;
}

interface TestConfig {
  baseUrl: string;
  endpoints: Array<{
    path: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  }>;
  concurrency: number;
  duration: number; // in seconds
  requestsPerSecond: number; // rate limiting (0 = no limit)
}

class PerformanceTester {
  private config: TestConfig;
  private results: Map<string, TestResult> = new Map();

  constructor(config: TestConfig) {
    this.config = config;
  }

  async run(): Promise<void> {
    console.log('Starting performance test...');
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Concurrency: ${this.config.concurrency}`);
    console.log(`Duration: ${this.config.duration}s`);
    console.log(`Endpoints: ${this.config.endpoints.length}`);
    console.log('');

    for (const endpoint of this.config.endpoints) {
      await this.testEndpoint(endpoint);
      console.log(''); // Add spacing between tests
    }

    this.printSummary();
  }

  private async testEndpoint(endpoint: any): Promise<void> {
    const key = `${endpoint.method} ${endpoint.path}`;
    console.log(`Testing ${key}...`);

    const result: TestResult = {
      endpoint: endpoint.path,
      method: endpoint.method,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
      requestsPerSecond: 0,
      errors: {},
    };

    const latencies: number[] = [];
    const startTime = performance.now();
    const endTime = startTime + this.config.duration * 1000;
    const workers: Promise<void>[] = [];

    // Rate limiting setup
    let lastRequestTime = 0;
    const minInterval = this.config.requestsPerSecond ? 1000 / this.config.requestsPerSecond : 0;

    // Create worker function
    const worker = async () => {
      while (performance.now() < endTime) {
        // Rate limiting
        if (minInterval > 0) {
          const now = performance.now();
          const timeSinceLastRequest = now - lastRequestTime;
          if (timeSinceLastRequest < minInterval) {
            await this.sleep(minInterval - timeSinceLastRequest);
          }
          lastRequestTime = performance.now();
        }

        const requestStart = performance.now();

        try {
          const response = await fetch(`${this.config.baseUrl}${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
              ...endpoint.headers,
            },
            body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
          });

          const latency = performance.now() - requestStart;
          latencies.push(latency);
          result.totalRequests++;

          if (response.ok) {
            result.successfulRequests++;
          } else {
            result.failedRequests++;
            const status = `${response.status}`;
            result.errors[status] = (result.errors[status] || 0) + 1;
          }

          result.minLatency = Math.min(result.minLatency, latency);
          result.maxLatency = Math.max(result.maxLatency, latency);
        } catch (error) {
          const latency = performance.now() - requestStart;
          latencies.push(latency);
          result.totalRequests++;
          result.failedRequests++;

          const errorType = error instanceof Error ? error.name : 'Unknown';
          result.errors[errorType] = (result.errors[errorType] || 0) + 1;
        }

        // Small delay to prevent overwhelming the server
        await this.sleep(10);
      }
    };

    // Start workers
    for (let i = 0; i < this.config.concurrency; i++) {
      workers.push(worker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Calculate statistics
    const totalDuration = (performance.now() - startTime) / 1000;
    result.requestsPerSecond = result.totalRequests / totalDuration;

    if (latencies.length > 0) {
      // Calculate average
      const sum = latencies.reduce((a, b) => a + b, 0);
      result.averageLatency = sum / latencies.length;

      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      result.percentiles.p50 = this.percentile(latencies, 50);
      result.percentiles.p90 = this.percentile(latencies, 90);
      result.percentiles.p95 = this.percentile(latencies, 95);
      result.percentiles.p99 = this.percentile(latencies, 99);
    }

    this.results.set(key, result);
    this.printResult(result);
  }

  private percentile(values: number[], p: number): number {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)] ?? 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private printResult(result: TestResult): void {
    console.log(`  Total requests: ${result.totalRequests}`);
    console.log(
      `  Successful: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)`
    );
    console.log(
      `  Failed: ${result.failedRequests} (${((result.failedRequests / result.totalRequests) * 100).toFixed(1)}%)`
    );
    console.log(`  Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`  Latency (ms):`);
    console.log(`    Average: ${result.averageLatency.toFixed(2)}`);
    console.log(`    Min: ${result.minLatency.toFixed(2)}`);
    console.log(`    Max: ${result.maxLatency.toFixed(2)}`);
    console.log(`    p50: ${result.percentiles.p50.toFixed(2)}`);
    console.log(`    p90: ${result.percentiles.p90.toFixed(2)}`);
    console.log(`    p95: ${result.percentiles.p95.toFixed(2)}`);
    console.log(`    p99: ${result.percentiles.p99.toFixed(2)}`);

    if (Object.keys(result.errors).length > 0) {
      console.log(`  Errors:`);
      for (const [error, count] of Object.entries(result.errors)) {
        console.log(`    ${error}: ${count}`);
      }
    }
  }

  private printSummary(): void {
    console.log('\n=== Performance Test Summary ===\n');

    let totalRequests = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (const [key, result] of this.results) {
      totalRequests += result.totalRequests;
      totalSuccessful += result.successfulRequests;
      totalFailed += result.failedRequests;

      console.log(`${key}:`);
      console.log(
        `  Success rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`
      );
      console.log(`  Avg latency: ${result.averageLatency.toFixed(2)}ms`);
      console.log(`  Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);
      console.log('');
    }

    console.log('Overall:');
    console.log(`  Total requests: ${totalRequests}`);
    console.log(`  Success rate: ${((totalSuccessful / totalRequests) * 100).toFixed(1)}%`);
    console.log(`  Failed requests: ${totalFailed}`);
  }
}

// Load test scenarios
async function runWebhookTest(): Promise<void> {
  const testWebhookPayload = {
    type: 'alert.triggered',
    event_id: 'test-' + Date.now(),
    triggered_at: new Date().toISOString(),
    data: {
      alert: {
        id: 'test-alert',
        name: 'Performance Test Alert',
        symbol: 'AAPL',
        condition: 'price_above',
        threshold_value: 150,
        user_id: 'test-user',
      },
      trigger: {
        current_value: 155,
        triggered_value: 155,
        change_percent: 3.33,
      },
    },
  };

  const signature = 'sha256=test-signature'; // In real test, calculate proper HMAC

  const config: TestConfig = {
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    endpoints: [
      {
        path: '/api/health',
        method: 'GET',
      },
      {
        path: '/api/health?detailed=true',
        method: 'GET',
      },
      {
        path: '/api/webhooks/test-team/stockalert',
        method: 'POST',
        headers: {
          'X-Signature': signature,
        },
        body: testWebhookPayload,
      },
    ],
    concurrency: parseInt(process.env.CONCURRENCY || '10'),
    duration: parseInt(process.env.DURATION || '30'),
    requestsPerSecond: parseInt(process.env.RPS || '0'),
  };

  const tester = new PerformanceTester(config);
  await tester.run();
}

// Command-line argument handling
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
StockAlert Slack App Performance Test

Usage: npm run test:performance [options]

Environment Variables:
  TEST_BASE_URL    Base URL for testing (default: http://localhost:3000)
  CONCURRENCY      Number of concurrent workers (default: 10)
  DURATION         Test duration in seconds (default: 30)
  RPS              Requests per second limit (optional)

Examples:
  # Test local development server
  npm run test:performance

  # Test production with rate limiting
  TEST_BASE_URL=https://your-app.vercel.app RPS=100 npm run test:performance

  # High concurrency test
  CONCURRENCY=50 DURATION=60 npm run test:performance
`);
    process.exit(0);
  }

  try {
    await runWebhookTest();
  } catch (error) {
    console.error('Performance test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}
