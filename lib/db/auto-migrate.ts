import { sql } from '@vercel/postgres';

// This runs automatically when the module is imported
let migrationPromise: Promise<void> | null = null;

// Use a proper logger in production, console.log is acceptable for migrations
const logger = {
  info: (message: string) => {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log(`[DB Migration] ${message}`);
    }
  },
  error: (message: string, error?: unknown) => {
    console.error(`[DB Migration Error] ${message}`, error);
  },
};

async function runMigrations(): Promise<void> {
  try {
    // Check if database URL is configured
    if (!process.env['POSTGRES_URL']) {
      logger.info('POSTGRES_URL not configured. Skipping auto-migration.');
      return;
    }

    logger.info('Checking database schema...');

    // Check if the table exists first
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'slack_installations'
      ) as table_exists
    `;

    if (!tableCheck.rows[0]?.table_exists) {
      logger.info('Table slack_installations does not exist yet. Skipping auto-migration.');
      return;
    }

    // Check if columns exist
    const result = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'slack_installations' 
      AND column_name IN ('stockalert_api_key', 'stockalert_webhook_id', 'stockalert_webhook_secret')
    `;

    const existingColumns = result.rows.map((row) => row.column_name as string);
    const requiredColumns = [
      'stockalert_api_key',
      'stockalert_webhook_id',
      'stockalert_webhook_secret',
    ] as const;
    const missingColumns = requiredColumns.filter((col) => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      logger.info('Running auto-migration: Adding missing columns...');

      // Add missing columns
      for (const column of missingColumns) {
        // Validate column name to prevent SQL injection (though these are hardcoded)
        if (!/^[a-z_]+$/.test(column)) {
          throw new Error(`Invalid column name: ${column}`);
        }

        // Use separate queries for each column since Vercel Postgres doesn't support dynamic identifiers
        switch (column) {
          case 'stockalert_api_key':
            await sql`ALTER TABLE slack_installations ADD COLUMN IF NOT EXISTS stockalert_api_key text`;
            break;
          case 'stockalert_webhook_id':
            await sql`ALTER TABLE slack_installations ADD COLUMN IF NOT EXISTS stockalert_webhook_id text`;
            break;
          case 'stockalert_webhook_secret':
            await sql`ALTER TABLE slack_installations ADD COLUMN IF NOT EXISTS stockalert_webhook_secret text`;
            break;
        }

        logger.info(`Added column: ${column}`);
      }

      logger.info('Auto-migration completed successfully');
    } else {
      logger.info('Database schema is up to date');
    }
  } catch (error) {
    // Specific error handling for common database issues
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        logger.error(
          'Cannot connect to database. The app will continue without database features.',
          error.message
        );
      } else if (error.message.includes('permission denied')) {
        logger.error('Insufficient database permissions for auto-migration.', error.message);
      } else {
        logger.error('Auto-migration error:', error);
      }
    } else {
      logger.error('Auto-migration error:', error);
    }
    // Don't throw - we don't want to break the app if migration fails
    // The app will work without these columns, just without API integration
  }
}

// Export a function that ensures migrations have run
export async function ensureMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigrations();
  }
  await migrationPromise;
}

// Run migrations immediately on module load
ensureMigrated();
