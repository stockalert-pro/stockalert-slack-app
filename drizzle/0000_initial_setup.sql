-- StockAlert Slack App Initial Database Setup
-- This migration creates all necessary tables for the application

-- Create slack_installations table
CREATE TABLE IF NOT EXISTS "slack_installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"team_name" text,
	"bot_token" text NOT NULL,
	"bot_id" text NOT NULL,
	"bot_user_id" text NOT NULL,
	"app_id" text NOT NULL,
	"enterprise_id" text,
	"enterprise_name" text,
	"installer_user_id" text,
	"scope" text,
	"token_type" text DEFAULT 'bot',
	"stockalert_api_key" text,
	"stockalert_webhook_id" text,
	"stockalert_webhook_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_installations_team_id_enterprise_id_unique" UNIQUE("team_id","enterprise_id")
);

-- Create slack_channels table
CREATE TABLE IF NOT EXISTS "slack_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_channels_team_id_channel_id_unique" UNIQUE("team_id","channel_id")
);

-- Create oauth_states table
CREATE TABLE IF NOT EXISTS "oauth_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"team_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "team_id_idx" ON "slack_installations" ("team_id");
CREATE INDEX IF NOT EXISTS "channel_team_id_idx" ON "slack_channels" ("team_id");
CREATE INDEX IF NOT EXISTS "state_idx" ON "oauth_states" ("state");
CREATE INDEX IF NOT EXISTS "expires_at_idx" ON "oauth_states" ("expires_at");
CREATE INDEX IF NOT EXISTS "event_id_idx" ON "webhook_events" ("event_id");
CREATE INDEX IF NOT EXISTS "webhook_team_id_idx" ON "webhook_events" ("team_id");
CREATE INDEX IF NOT EXISTS "created_at_idx" ON "webhook_events" ("created_at");

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_slack_installations_updated_at BEFORE UPDATE ON "slack_installations" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_channels_updated_at BEFORE UPDATE ON "slack_channels" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();