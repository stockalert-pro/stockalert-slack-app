import { kv } from '@vercel/kv';

// Metric types
export type MetricType = 'counter' | 'histogram' | 'gauge';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, string>;
}

// Performance tracking
class PerformanceTracker {
  private timers = new Map<string, number>();

  start(name: string): void {
    this.timers.set(name, Date.now());
  }

  end(name: string, tags?: Record<string, string>): PerformanceMetric | null {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Performance timer '${name}' was not started`);
      return null;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      tags,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance: ${name} took ${duration}ms`, tags);
    }

    // Store in KV if available
    this.storeMetric(metric).catch((error) => {
      console.error('Failed to store performance metric:', error);
    });

    return metric;
  }

  private async storeMetric(metric: PerformanceMetric): Promise<void> {
    if (!process.env.KV_URL) {
      return;
    }

    const key = `metrics:performance:${metric.name}:${metric.timestamp}`;
    await kv.set(key, metric, { ex: 86400 }); // Expire after 24 hours
  }
}

// Monitoring class
export class Monitor {
  private static instance: Monitor;
  private performance: PerformanceTracker;
  private metrics: Map<string, Metric[]> = new Map();

  private constructor() {
    this.performance = new PerformanceTracker();
  }

  static getInstance(): Monitor {
    if (!Monitor.instance) {
      Monitor.instance = new Monitor();
    }
    return Monitor.instance;
  }

  // Performance tracking
  startTimer(name: string): void {
    this.performance.start(name);
  }

  endTimer(name: string, tags?: Record<string, string>): PerformanceMetric | null {
    return this.performance.end(name, tags);
  }

  // Metric recording
  recordMetric(metric: Metric): void {
    const key = `${metric.name}:${JSON.stringify(metric.tags || {})}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);

    // Store in KV if available
    this.storeMetric(metric).catch((error) => {
      console.error('Failed to store metric:', error);
    });
  }

  // Counter increment
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'counter',
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  // Gauge recording
  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'gauge',
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  // Histogram recording
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'histogram',
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  // Get metrics summary
  async getMetricsSummary(): Promise<Record<string, any>> {
    const summary: Record<string, any> = {
      timestamp: new Date().toISOString(),
      metrics: {},
    };

    // Process in-memory metrics
    for (const [key, values] of this.metrics.entries()) {
      const [name] = key.split(':');

      if (!name) continue;

      if (!summary.metrics[name]) {
        summary.metrics[name] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          avg: 0,
          latest: 0,
        };
      }

      const stats = summary.metrics[name];
      if (stats) {
        for (const metric of values) {
          stats.count++;
          stats.sum += metric.value;
          stats.min = Math.min(stats.min, metric.value);
          stats.max = Math.max(stats.max, metric.value);
          stats.latest = metric.value;
        }
      }

      if (stats) {
        stats.avg = stats.sum / stats.count;
      }
    }

    // Get recent performance metrics from KV
    if (process.env.KV_URL) {
      try {
        const perfKeys = await kv.keys('metrics:performance:*');
        const recentPerf: PerformanceMetric[] = [];

        for (const key of perfKeys.slice(0, 100)) {
          // Limit to recent 100
          const metric = await kv.get<PerformanceMetric>(key);
          if (metric) {
            recentPerf.push(metric);
          }
        }

        // Group by name
        const perfByName: Record<string, any> = {};
        for (const metric of recentPerf) {
          if (!perfByName[metric.name]) {
            perfByName[metric.name] = {
              count: 0,
              totalDuration: 0,
              minDuration: Infinity,
              maxDuration: -Infinity,
              avgDuration: 0,
            };
          }

          const stats = perfByName[metric.name];
          stats.count++;
          stats.totalDuration += metric.duration;
          stats.minDuration = Math.min(stats.minDuration, metric.duration);
          stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
        }

        // Calculate averages
        for (const name in perfByName) {
          const stats = perfByName[name];
          stats.avgDuration = stats.totalDuration / stats.count;
        }

        summary.performance = perfByName;
      } catch (error) {
        console.error('Failed to fetch performance metrics:', error);
      }
    }

    return summary;
  }

  // Store metric in KV
  private async storeMetric(metric: Metric): Promise<void> {
    if (!process.env.KV_URL) {
      return;
    }

    const key = `metrics:${metric.type}:${metric.name}:${metric.timestamp}`;
    await kv.set(key, metric, { ex: 86400 }); // Expire after 24 hours
  }

  // Clean up old metrics
  async cleanup(): Promise<void> {
    // Clear in-memory metrics older than 1 hour
    const oneHourAgo = Date.now() - 3600000;

    for (const [key, values] of this.metrics.entries()) {
      const recentValues = values.filter((m) => m.timestamp > oneHourAgo);
      if (recentValues.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, recentValues);
      }
    }
  }
}

// Monitoring decorators
export function monitored(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = Monitor.getInstance();
      monitor.startTimer(metricName);

      try {
        const result = await originalMethod.apply(this, args);
        monitor.endTimer(metricName, { status: 'success' });
        return result;
      } catch (error) {
        monitor.endTimer(metricName, { status: 'error' });
        throw error;
      }
    };

    return descriptor;
  };
}

// Express middleware for request monitoring
export function requestMonitoring() {
  return (req: any, res: any, next: any) => {
    const monitor = Monitor.getInstance();
    const start = Date.now();

    // Track request start
    monitor.incrementCounter('http.requests', 1, {
      method: req.method,
      path: req.path,
    });

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Date.now() - start;

      // Record request duration
      monitor.recordHistogram('http.request.duration', duration, {
        method: req.method,
        path: req.path,
        status: res.statusCode.toString(),
      });

      // Record response status
      monitor.incrementCounter('http.responses', 1, {
        method: req.method,
        path: req.path,
        status: res.statusCode.toString(),
      });

      originalEnd.apply(res, args);
    };

    next();
  };
}

// Helper function to measure async operations
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const monitor = Monitor.getInstance();
  monitor.startTimer(name);

  try {
    const result = await operation();
    monitor.endTimer(name, { ...tags, status: 'success' });
    return result;
  } catch (error) {
    monitor.endTimer(name, { ...tags, status: 'error' });
    throw error;
  }
}

// System metrics collection
export async function collectSystemMetrics(): Promise<void> {
  const monitor = Monitor.getInstance();

  // Memory usage
  const memUsage = process.memoryUsage();
  monitor.recordGauge('system.memory.heapUsed', memUsage.heapUsed);
  monitor.recordGauge('system.memory.heapTotal', memUsage.heapTotal);
  monitor.recordGauge('system.memory.rss', memUsage.rss);
  monitor.recordGauge('system.memory.external', memUsage.external);

  // CPU usage (if available)
  if (process.cpuUsage) {
    const cpuUsage = process.cpuUsage();
    monitor.recordGauge('system.cpu.user', cpuUsage.user);
    monitor.recordGauge('system.cpu.system', cpuUsage.system);
  }

  // Event loop lag (simple approximation)
  const start = Date.now();
  setImmediate(() => {
    const lag = Date.now() - start;
    monitor.recordGauge('system.eventLoop.lag', lag);
  });
}

// Start periodic system metrics collection
export function startMetricsCollection(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    collectSystemMetrics().catch(console.error);
    Monitor.getInstance().cleanup().catch(console.error);
  }, intervalMs);
}
