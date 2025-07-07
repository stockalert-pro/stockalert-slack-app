import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    checks: {
      postgres: false,
    },
  };

  // Check Postgres
  try {
    await sql`SELECT 1`;
    health.checks.postgres = true;
  } catch (error) {
    console.error('Postgres health check failed:', error);
  }

  // Overall status
  const allHealthy = health.checks.postgres === true;
  health.status = allHealthy ? 'ok' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(health);
}