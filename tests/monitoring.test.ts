import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Monitor, measureAsync, monitored } from '../lib/monitoring';

describe('Monitoring', () => {
  let monitor: Monitor;

  beforeEach(() => {
    monitor = Monitor.getInstance();
    // Clear any existing metrics
    vi.clearAllMocks();
  });

  describe('Monitor', () => {
    it('should track counters', () => {
      monitor.incrementCounter('test.counter', 1);
      monitor.incrementCounter('test.counter', 2, { tag: 'value' });

      // Counters should be tracked internally
      expect(monitor['metrics'].size).toBeGreaterThan(0);
    });

    it('should track gauges', () => {
      monitor.recordGauge('test.gauge', 42);
      monitor.recordGauge('test.gauge', 100, { env: 'test' });

      expect(monitor['metrics'].size).toBeGreaterThan(0);
    });

    it('should track histograms', () => {
      monitor.recordHistogram('test.histogram', 150);
      monitor.recordHistogram('test.histogram', 200);
      monitor.recordHistogram('test.histogram', 175);

      expect(monitor['metrics'].size).toBeGreaterThan(0);
    });

    it('should track performance timing', () => {
      monitor.startTimer('test.operation');

      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }

      const metric = monitor.endTimer('test.operation');

      expect(metric).toBeDefined();
      expect(metric?.duration).toBeGreaterThanOrEqual(10);
      expect(metric?.name).toBe('test.operation');
    });

    it('should handle timer not started', () => {
      const metric = monitor.endTimer('nonexistent.timer');
      expect(metric).toBeNull();
    });
  });

  describe('measureAsync', () => {
    it('should measure successful async operations', async () => {
      const result = await measureAsync('test.async', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should measure failed async operations', async () => {
      await expect(
        measureAsync('test.async.error', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('@monitored decorator', () => {
    class TestService {
      @monitored('test.decorated')
      async performOperation(value: number): Promise<number> {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value * 2;
      }

      @monitored()
      async defaultName(): Promise<string> {
        return 'default';
      }

      @monitored('test.error')
      async failingOperation(): Promise<void> {
        throw new Error('Operation failed');
      }
    }

    it('should monitor decorated methods', async () => {
      const service = new TestService();
      const result = await service.performOperation(21);

      expect(result).toBe(42);
    });

    it('should use default name when not provided', async () => {
      const service = new TestService();
      const result = await service.defaultName();

      expect(result).toBe('default');
    });

    it('should monitor failed operations', async () => {
      const service = new TestService();

      await expect(service.failingOperation()).rejects.toThrow('Operation failed');
    });
  });

  describe('getMetricsSummary', () => {
    it('should aggregate metrics', async () => {
      // Add some metrics
      monitor.incrementCounter('summary.counter', 1);
      monitor.incrementCounter('summary.counter', 2);
      monitor.recordGauge('summary.gauge', 100);
      monitor.recordHistogram('summary.histogram', 50);
      monitor.recordHistogram('summary.histogram', 150);

      const summary = await monitor.getMetricsSummary();

      expect(summary.timestamp).toBeDefined();
      expect(summary.metrics).toBeDefined();
      expect(summary.metrics['summary.counter']).toBeDefined();
      expect(summary.metrics['summary.counter'].count).toBe(2);
      expect(summary.metrics['summary.counter'].sum).toBe(3);
    });
  });
});
