import * as crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const payloadString = typeof payload === 'string' ? payload : payload.toString();
  
  // Calculate expected signature - HMAC-SHA256 with hex encoding
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    // If buffers have different lengths, return false
    return false;
  }
}