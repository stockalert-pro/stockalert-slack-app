# Database Migrations

This directory contains database migrations for the StockAlert Slack App.

## Initial Setup

For new installations, run:

```bash
npm run db:setup
```

This will:
1. Check your database connection
2. Create all necessary tables
3. Set up indexes and triggers

## Migration Files

- `0000_initial_setup.sql` - Creates all tables needed for the application:
  - `slack_installations` - Stores Slack workspace installations
  - `slack_channels` - Manages Slack channels for notifications
  - `oauth_states` - Handles OAuth flow security
  - `webhook_events` - Logs incoming webhook events

## Manual Migration

If you prefer to run the migration manually:

```bash
psql $POSTGRES_URL < drizzle/0000_initial_setup.sql
```

## Generating New Migrations

To create new migrations after schema changes:

```bash
npm run db:generate
```

This uses Drizzle Kit to generate SQL migration files based on changes in `lib/db/schema.ts`.