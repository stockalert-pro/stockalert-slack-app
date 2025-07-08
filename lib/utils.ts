import { randomBytes } from 'crypto';

/**
 * Generate a secure webhook secret in the format: whsec_<64 hex chars>
 * This matches the StockAlert.pro webhook secret format
 */
export function generateWebhookSecret(): string {
  const secret = randomBytes(32).toString('hex');
  return `whsec_${secret}`;
}