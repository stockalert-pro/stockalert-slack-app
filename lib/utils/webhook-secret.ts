import crypto from 'crypto';

/**
 * Generate a secure webhook secret
 * Format: whsec_{32 bytes hex}
 */
export function generateWebhookSecret(): string {
  const bytes = crypto.randomBytes(32);
  return `whsec_${bytes.toString('hex')}`;
}

/**
 * Validate webhook secret format
 */
export function isValidWebhookSecret(secret: string): boolean {
  // Must start with whsec_ and be followed by 64 hex characters
  return /^whsec_[0-9a-f]{64}$/i.test(secret);
}