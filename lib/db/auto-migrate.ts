import { sql } from 'drizzle-orm';
import { db } from './index';

// This runs automatically when the module is imported
let migrationPromise: Promise<void> | null = null;

async function runMigrations() {
  try {
    console.log('Checking database schema...');
    
    // Check if columns exist
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'slack_installations' 
      AND column_name IN ('stockalert_api_key', 'stockalert_webhook_id', 'stockalert_webhook_secret')
    `);
    
    const existingColumns = result.rows.map(row => row.column_name);
    const requiredColumns = ['stockalert_api_key', 'stockalert_webhook_id', 'stockalert_webhook_secret'];
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('Running auto-migration: Adding missing columns...');
      
      // Add missing columns
      for (const column of missingColumns) {
        await db.execute(sql`
          ALTER TABLE slack_installations 
          ADD COLUMN IF NOT EXISTS ${sql.identifier(column)} text
        `);
        console.log(`Added column: ${column}`);
      }
      
      console.log('Auto-migration completed successfully');
    } else {
      console.log('Database schema is up to date');
    }
  } catch (error) {
    console.error('Auto-migration error:', error);
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