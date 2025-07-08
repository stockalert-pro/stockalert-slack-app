-- First convert string values to boolean equivalent
ALTER TABLE "slack_channels" ALTER COLUMN "is_default" SET DATA TYPE boolean USING CASE WHEN "is_default" = 'true' THEN true ELSE false END;--> statement-breakpoint
ALTER TABLE "slack_channels" ALTER COLUMN "is_default" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD COLUMN "stockalert_api_key" text;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD COLUMN "stockalert_webhook_id" text;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD COLUMN "stockalert_webhook_secret" text;