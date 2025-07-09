#!/usr/bin/env tsx
/* eslint-disable no-console */

import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { migrate } from 'drizzle-orm/vercel-postgres/migrator';
import * as fs from 'fs';
import * as path from 'path';

async function setupDatabase(): Promise<void> {
  console.log('🚀 StockAlert Slack App - Database Setup');
  console.log('=======================================\n');

  // Check for required environment variable
  if (!process.env.POSTGRES_URL) {
    console.error('❌ Error: POSTGRES_URL environment variable is not set');
    console.log('\nPlease set your PostgreSQL connection string:');
    console.log('export POSTGRES_URL="postgresql://user:password@host:port/database"');
    console.log('\nFor local development, you can use:');
    console.log('- PostgreSQL: postgresql://localhost:5432/stockalert_slack');
    console.log('- Neon: https://neon.tech (recommended for Vercel)');
    console.log('- Supabase: https://supabase.com');
    process.exit(1);
  }

  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful\n');

    // Check if this is a fresh installation
    console.log('🔍 Checking existing tables...');
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('slack_installations', 'slack_channels', 'oauth_states', 'webhook_events')
    `;

    if (tables.rows.length === 0) {
      console.log('📦 Fresh installation detected\n');

      // Run the initial setup migration
      console.log('🏗️  Creating database tables...');
      const migrationPath = path.join(__dirname, '..', 'drizzle', '0000_initial_setup.sql');

      if (fs.existsSync(migrationPath)) {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
        await sql.query(migrationSQL);
        console.log('✅ Database tables created successfully\n');
      } else {
        console.error('❌ Error: Initial migration file not found');
        console.log(`Expected at: ${migrationPath}`);
        process.exit(1);
      }
    } else {
      console.log(`✅ Found ${tables.rows.length} existing tables\n`);

      // Run any pending migrations
      console.log('🔄 Running database migrations...');
      const db = drizzle(sql);
      await migrate(db, { migrationsFolder: './drizzle' });
      console.log('✅ Migrations completed successfully\n');
    }

    // Verify final schema
    console.log('🔍 Verifying database schema...');
    const finalTables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('slack_installations', 'slack_channels', 'oauth_states', 'webhook_events')
      ORDER BY tablename
    `;

    console.log('📊 Database tables:');
    for (const table of finalTables.rows) {
      console.log(`   ✓ ${table.tablename}`);
    }

    console.log('\n✅ Database setup completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('1. Set up your environment variables in .env:');
    console.log('   - SLACK_CLIENT_ID');
    console.log('   - SLACK_CLIENT_SECRET');
    console.log('   - SLACK_SIGNING_SECRET');
    console.log('   - BASE_URL');
    console.log('2. Run the development server: npm run dev');
    console.log('3. Visit http://localhost:3000 to install the Slack app');
  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your POSTGRES_URL is correct');
    console.log('2. Ensure the database exists and is accessible');
    console.log('3. Verify you have CREATE TABLE permissions');
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}
