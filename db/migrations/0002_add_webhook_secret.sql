-- Add webhook_secret column to installations table
ALTER TABLE slack_installations ADD COLUMN webhook_secret TEXT;

-- Generate unique secrets for existing installations
-- In production, you would need to generate actual unique secrets
UPDATE slack_installations 
SET webhook_secret = 'whsec_' || encode(gen_random_bytes(32), 'hex')
WHERE webhook_secret IS NULL;