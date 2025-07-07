import * as crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  // StockAlert sends signature without any prefix
  const payloadString = typeof payload === 'string' ? payload : payload.toString();
  
  // Calculate expected signature - HMAC-SHA256 with hex encoding
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  console.log('Webhook signature verification:', {
    receivedSignature: signature,
    expectedSignature: expectedSignature,
    secretLength: secret.length,
    secretPrefix: secret.substring(0, 3),
    payloadLength: payloadString.length,
    payloadSample: payloadString.substring(0, 100),
  });

  // Use timing-safe comparison to prevent timing attacks
  try {
    const result = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    if (result) {
      console.log('Webhook signature verified successfully');
    } else {
      console.log('Webhook signature verification failed');
    }
    
    return result;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}