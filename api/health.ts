import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db';
import { sql } from '@vercel/postgres';

// KV is optional
let kv: any = null;
try {
  // Only try to load KV if environment variables are present
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    kv = require('@vercel/kv').kv;
  }
} catch (e) {
  // KV not available
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    checks: {
      postgres: false,
      kv: false,
    },
  };

  // Check Postgres
  try {
    await sql`SELECT 1`;
    health.checks.postgres = true;
  } catch (error) {
    console.error('Postgres health check failed:', error);
  }

  // Check KV (if available)
  if (kv) {
    try {
      await kv.ping();
      health.checks.kv = true;
    } catch (error) {
      console.error('KV health check failed:', error);
    }
  } else {
    health.checks.kv = 'not configured';
  }

  // Overall status
  const allHealthy = health.checks.postgres === true;
  health.status = allHealthy ? 'ok' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(health);
}