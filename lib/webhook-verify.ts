import * as crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  // Remove 'sha256=' prefix if present
  const signatureHash = signature.startsWith('sha256=') 
    ? signature.slice(7) 
    : signature;

  // Try different payload formats
  const payloadString = typeof payload === 'string' ? payload : payload.toString();
  
  // Method 1: Standard HMAC with JSON string
  const expectedSignature1 = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  // Method 2: Try with sorted JSON (some APIs do this)
  let expectedSignature2 = '';
  try {
    const parsedPayload = JSON.parse(payloadString);
    const sortedPayload = JSON.stringify(parsedPayload, Object.keys(parsedPayload).sort());
    expectedSignature2 = crypto
      .createHmac('sha256', secret)
      .update(sortedPayload)
      .digest('hex');
  } catch (e) {
    // If JSON parsing fails, skip this method
  }

  // Method 3: Try with trimmed secret (in case of whitespace)
  const expectedSignature3 = crypto
    .createHmac('sha256', secret.trim())
    .update(payloadString)
    .digest('hex');

  // Debug logging with all methods
  console.log('Webhook signature verification:', {
    receivedSignature: signature,
    receivedHash: signatureHash,
    expectedHash1_standard: expectedSignature1,
    expectedHash2_sorted: expectedSignature2,
    expectedHash3_trimmed: expectedSignature3,
    secretLength: secret.length,
    secretTrimmedLength: secret.trim().length,
    payloadLength: payloadString.length,
    payloadSample: payloadString.substring(0, 200),
    payloadLastChars: payloadString.substring(payloadString.length - 50),
  });

  // Use timing-safe comparison to prevent timing attacks
  try {
    // Check all methods
    const signatureBuffer = Buffer.from(signatureHash, 'hex');
    
    if (crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature1, 'hex'))) {
      console.log('Signature verified with method 1 (standard)');
      return true;
    }
    
    if (expectedSignature2 && crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature2, 'hex'))) {
      console.log('Signature verified with method 2 (sorted JSON)');
      return true;
    }
    
    if (crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature3, 'hex'))) {
      console.log('Signature verified with method 3 (trimmed secret)');
      return true;
    }
    
    console.log('Signature verification failed with all methods');
    return false;
  } catch (error) {
    // If buffers have different lengths, return false
    console.error('Signature verification error:', error);
    return false;
  }
}