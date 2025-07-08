import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { kv } from '@vercel/kv';
import { setSecurityHeaders } from '../lib/security-headers';
import { Monitor } from '../lib/monitoring';
import { Cache } from '../lib/cache';

interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    postgres: boolean;
    redis: boolean;
    slack: boolean;
  };
  metrics?: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
    cache?: any;
    monitoring?: any;
  };
  errors?: string[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Only allow GET requests
  if (req.method !== 'GET') {
    setSecurityHeaders(res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set security headers
  setSecurityHeaders(res);

  const monitor = Monitor.getInstance();
  monitor.startTimer('health.check');

  const errors: string[] = [];
  const startTime = process.uptime();
  const health: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    uptime: Math.floor(startTime),
    checks: {
      postgres: false,
      redis: false,
      slack: false,
    },
  };

  // Check Postgres with timeout
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database health check timeout')), 5000)
    );

    const queryPromise = sql`SELECT 1 as health_check`;

    await Promise.race([queryPromise, timeoutPromise]);
    health.checks.postgres = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Postgres health check failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    errors.push(`Database: ${errorMessage}`);
  }

  // Check Redis/KV with timeout
  if (process.env.KV_URL) {
    try {
      const kvTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('KV health check timeout')), 3000)
      );

      const kvCheck = kv.set('health:check', Date.now(), { ex: 60 });

      await Promise.race([kvCheck, kvTimeout]);
      health.checks.redis = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown KV error';
      console.error('KV health check failed:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      errors.push(`KV/Redis: ${errorMessage}`);
    }
  } else {
    health.checks.redis = true; // Mark as OK if not configured
  }

  // Check Slack API (only if bot token is available)
  if (process.env.SLACK_BOT_TOKEN) {
    try {
      const slackTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Slack API health check timeout')), 3000)
      );

      // Simple API test - auth.test is lightweight
      const slackCheck = fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json());

      const result = (await Promise.race([slackCheck, slackTimeout])) as any;
      health.checks.slack = result?.ok === true;

      if (!result?.ok) {
        errors.push(`Slack API: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Slack error';
      console.error('Slack health check failed:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      errors.push(`Slack API: ${errorMessage}`);
    }
  } else {
    health.checks.slack = true; // Mark as OK if not configured
  }

  // Include detailed metrics if requested
  if (req.query.detailed === 'true') {
    // Memory metrics
    const memUsage = process.memoryUsage();
    health.metrics = {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      },
    };

    // Cache statistics
    try {
      const cache = Cache.getInstance();
      health.metrics.cache = await cache.getStats();
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    // Monitoring metrics
    try {
      health.metrics.monitoring = await monitor.getMetricsSummary();
    } catch (error) {
      console.error('Failed to get monitoring metrics:', error);
    }
  }

  // Overall status determination
  const checkResults = Object.values(health.checks);
  const healthyChecks = checkResults.filter((check) => check === true).length;
  const totalChecks = checkResults.length;

  if (healthyChecks === totalChecks) {
    health.status = 'ok';
  } else if (healthyChecks > 0) {
    health.status = 'degraded';
  } else {
    health.status = 'error';
  }

  if (errors.length > 0) {
    health.errors = errors;
  }

  // End performance timing
  monitor.endTimer('health.check', {
    status: health.status,
    detailed: req.query.detailed === 'true' ? 'true' : 'false',
  });

  // Set cache headers for health check endpoint
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  return res.status(statusCode).json(health);
}
