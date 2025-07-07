import * as crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  timestamp?: string
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

  // Method 4: Try without the 'sk_' prefix (some APIs do this)
  let expectedSignature4 = '';
  if (secret.startsWith('sk_')) {
    expectedSignature4 = crypto
      .createHmac('sha256', secret.slice(3))
      .update(payloadString)
      .digest('hex');
  }

  // Method 5: Try with timestamp prepended (common pattern)
  let expectedSignature5 = '';
  if (timestamp) {
    const payloadWithTimestamp = `${timestamp}.${payloadString}`;
    expectedSignature5 = crypto
      .createHmac('sha256', secret)
      .update(payloadWithTimestamp)
      .digest('hex');
  }

  // Method 6: Try compact JSON (no spaces)
  let expectedSignature6 = '';
  try {
    const parsedPayload = JSON.parse(payloadString);
    const compactPayload = JSON.stringify(parsedPayload);
    expectedSignature6 = crypto
      .createHmac('sha256', secret)
      .update(compactPayload)
      .digest('hex');
  } catch (e) {
    // If JSON parsing fails, skip this method
  }

  // Debug logging with all methods
  console.log('Webhook signature verification:', {
    receivedSignature: signature,
    receivedHash: signatureHash,
    expectedHash1_standard: expectedSignature1,
    expectedHash2_sorted: expectedSignature2,
    expectedHash3_trimmed: expectedSignature3,
    expectedHash4_noPrefix: expectedSignature4,
    expectedHash5_timestamp: expectedSignature5,
    expectedHash6_compact: expectedSignature6,
    secretLength: secret.length,
    secretTrimmedLength: secret.trim().length,
    payloadLength: payloadString.length,
    payloadSample: payloadString.substring(0, 200),
    payloadLastChars: payloadString.substring(payloadString.length - 50),
    timestamp: timestamp || 'none',
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
    
    if (expectedSignature4 && crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature4, 'hex'))) {
      console.log('Signature verified with method 4 (no sk_ prefix)');
      return true;
    }
    
    if (expectedSignature5 && crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature5, 'hex'))) {
      console.log('Signature verified with method 5 (with timestamp)');
      return true;
    }
    
    if (expectedSignature6 && crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature6, 'hex'))) {
      console.log('Signature verified with method 6 (compact JSON)');
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