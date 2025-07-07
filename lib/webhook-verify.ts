import * as crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  timestamp?: string,
  url?: string,
  method?: string
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

  // Method 7: Try URL + payload (common webhook pattern)
  let expectedSignature7 = '';
  if (url) {
    const urlPayload = `${url}${payloadString}`;
    expectedSignature7 = crypto
      .createHmac('sha256', secret)
      .update(urlPayload)
      .digest('hex');
  }

  // Method 8: Try method + URL + payload
  let expectedSignature8 = '';
  if (url && method) {
    const fullPayload = `${method}${url}${payloadString}`;
    expectedSignature8 = crypto
      .createHmac('sha256', secret)
      .update(fullPayload)
      .digest('hex');
  }

  // Method 9: Try just the secret without prefix using raw bytes
  let expectedSignature9 = '';
  if (secret.startsWith('sk_')) {
    const secretWithoutPrefix = secret.slice(3);
    expectedSignature9 = crypto
      .createHmac('sha256', secretWithoutPrefix)
      .update(payload)
      .digest('hex');
  }

  // Method 10: Try with SHA1 instead of SHA256 (some older APIs)
  const expectedSignature10 = crypto
    .createHmac('sha1', secret)
    .update(payloadString)
    .digest('hex');

  // Debug logging with all methods
  console.log('Webhook signature verification (methods 1-6):', {
    receivedSignature: signature,
    receivedHash: signatureHash,
    expectedHash1_standard: expectedSignature1,
    expectedHash2_sorted: expectedSignature2,
    expectedHash3_trimmed: expectedSignature3,
    expectedHash4_noPrefix: expectedSignature4,
    expectedHash5_timestamp: expectedSignature5,
    expectedHash6_compact: expectedSignature6,
  });
  
  console.log('Webhook signature verification (methods 7-10):', {
    expectedHash7_urlPayload: expectedSignature7,
    expectedHash8_methodUrlPayload: expectedSignature8,
    expectedHash9_noPrefixRaw: expectedSignature9,
    expectedHash10_sha1: expectedSignature10,
    secretLength: secret.length,
    payloadLength: payloadString.length,
    url: url || 'none',
    method: method || 'none',
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
    
    if (expectedSignature7 && crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature7, 'hex'))) {
      console.log('Signature verified with method 7 (URL + payload)');
      return true;
    }
    
    if (expectedSignature8 && crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature8, 'hex'))) {
      console.log('Signature verified with method 8 (method + URL + payload)');
      return true;
    }
    
    if (expectedSignature9 && crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature9, 'hex'))) {
      console.log('Signature verified with method 9 (no prefix raw)');
      return true;
    }
    
    // SHA1 has different length, check separately
    if (expectedSignature10.length === signatureHash.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(signatureHash, 'hex'), Buffer.from(expectedSignature10, 'hex'))) {
          console.log('Signature verified with method 10 (SHA1)');
          return true;
        }
      } catch (e) {
        // Different lengths
      }
    }
    
    console.log('Signature verification failed with all methods');
    return false;
  } catch (error) {
    // If buffers have different lengths, return false
    console.error('Signature verification error:', error);
    return false;
  }
}