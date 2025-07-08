ALTER TABLE "slack_installations" ADD COLUMN "stockalert_api_key" text;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD COLUMN "stockalert_webhook_id" text;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD COLUMN "stockalert_webhook_secret" text;