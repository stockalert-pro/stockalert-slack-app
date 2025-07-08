import * as crypto from 'node:crypto';

/**
 * Verifies a webhook signature using HMAC-SHA256
 * @param payload - The webhook payload (string or Buffer)
 * @param signature - The signature from the webhook header
 * @param secret - The webhook secret
 * @returns true if the signature is valid
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  // Validate inputs
  if (!payload || !signature || !secret) {
    console.error('Missing required parameters for webhook signature verification');
    return false;
  }

  // Convert payload to string if needed
  const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');

  // Handle different signature formats
  // StockAlert.pro sends signatures with "sha256=" prefix
  let signatureToVerify = signature;
  if (signature.startsWith('sha256=')) {
    signatureToVerify = signature.slice(7); // Remove "sha256=" prefix
  }

  // Validate signature format (should be hex)
  if (!/^[a-f0-9]+$/i.test(signatureToVerify)) {
    console.error('Invalid webhook signature format');
    return false;
  }

  // Calculate expected signature - HMAC-SHA256 with hex encoding
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureToVerify, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    // If buffers have different lengths or invalid hex encoding
    console.error('Webhook signature comparison failed:', error);
    return false;
  }
}
