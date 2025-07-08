import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { migrate } from 'drizzle-orm/vercel-postgres/migrator';

async function runMigrations(): Promise<void> {
  const db = drizzle(sql);

  // eslint-disable-next-line no-console
  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    // eslint-disable-next-line no-console
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
