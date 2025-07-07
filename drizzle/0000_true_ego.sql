CREATE TABLE "slack_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text,
	"is_default" text DEFAULT 'false',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_channels_team_id_channel_id_unique" UNIQUE("team_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "slack_installations" (
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_installations_team_id_enterprise_id_unique" UNIQUE("team_id","enterprise_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"team_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX "channel_team_id_idx" ON "slack_channels" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_id_idx" ON "slack_installations" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "state_idx" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "expires_at_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "event_id_idx" ON "webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "webhook_team_id_idx" ON "webhook_events" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "webhook_events" USING btree ("created_at");