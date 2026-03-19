import * as crypto from 'node:crypto';

/**
 * Verifies a webhook signature using HMAC-SHA256
 * Updated for StockAlert.pro v1 API
 *
 * According to the API spec (openapi.yaml):
 * - Header: X-StockAlert-Signature
 * - Algorithm: HMAC-SHA256
 * - Format: Plain hex digest (no prefix), with optional legacy `sha256=` prefix
 * - Current signing mode may include `${timestamp}.${payload}` when `X-StockAlert-Timestamp` is present
 * - Legacy signing mode uses the raw payload body directly
 * - Note: Slack webhooks do not include signatures
 *
 * @param payload - The webhook payload (string or Buffer)
 * @param signature - The signature from the X-StockAlert-Signature header
 * @param secret - The webhook secret
 * @returns true if the signature is valid
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  timestamp?: string
): boolean {
  // Validate inputs
  if (!payload || !signature || !secret) {
    console.error('Missing required parameters for webhook signature verification');
    return false;
  }

  // Convert payload to string if needed
  const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');

  // New API format: plain hex digest
  // Legacy format: "sha256=" prefix (for backward compatibility)
  let signatureToVerify = signature;
  if (signature.startsWith('sha256=')) {
    signatureToVerify = signature.slice(7); // Remove legacy "sha256=" prefix
    console.warn('Legacy signature format detected (sha256= prefix). Consider updating to v1 API.');
  }

  // Validate signature format (should be hex)
  if (!/^[a-f0-9]+$/i.test(signatureToVerify)) {
    console.error('Invalid webhook signature format - expected hex string');
    return false;
  }

  // Calculate expected signature using HMAC-SHA256
  // As per API spec: HMAC-SHA256(secret, JSON.stringify(payload))
  const payloadVariants =
    timestamp && timestamp.length > 0 ? [`${timestamp}.${payloadString}`, payloadString] : [payloadString];

  for (const signingPayload of payloadVariants) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signingPayload, 'utf8')
      .digest('hex');

    try {
      if (
        crypto.timingSafeEqual(
          Buffer.from(signatureToVerify, 'hex'),
          Buffer.from(expectedSignature, 'hex')
        )
      ) {
        return true;
      }
    } catch (error) {
      console.error('Webhook signature comparison failed:', error);
      return false;
    }
  }

  return false;
}
