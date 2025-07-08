import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import * as schema from './schema';

// Create a single database instance to be reused
// Vercel Postgres handles connection pooling automatically
export const db = drizzle(sql, { schema });

// Re-export schema types for convenience
export * from './schema';
