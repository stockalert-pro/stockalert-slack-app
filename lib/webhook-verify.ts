import * as crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  // StockAlert sends signature without any prefix
  const payloadString = typeof payload === 'string' ? payload : payload.toString();
  
  // Debug: Let's try multiple variations to understand what's happening
  const variations = [
    {
      name: 'standard',
      signature: crypto.createHmac('sha256', secret).update(payloadString).digest('hex')
    },
    {
      name: 'without sk_ prefix',
      signature: secret.startsWith('sk_') 
        ? crypto.createHmac('sha256', secret.slice(3)).update(payloadString).digest('hex')
        : ''
    },
    {
      name: 'buffer instead of string',
      signature: crypto.createHmac('sha256', secret).update(Buffer.from(payloadString)).digest('hex')
    },
    {
      name: 'utf8 encoding explicit',
      signature: crypto.createHmac('sha256', secret).update(payloadString, 'utf8').digest('hex')
    },
    {
      name: 'compact JSON',
      signature: (() => {
        try {
          const parsed = JSON.parse(payloadString);
          const compact = JSON.stringify(parsed);
          return crypto.createHmac('sha256', secret).update(compact).digest('hex');
        } catch {
          return '';
        }
      })()
    }
  ];

  console.log('Webhook signature verification attempts:');
  variations.forEach(v => {
    if (v.signature) {
      console.log(`- ${v.name}: ${v.signature} (match: ${v.signature === signature})`);
    }
  });

  console.log('Debug info:', {
    receivedSignature: signature,
    secretLength: secret.length,
    secretValue: `${secret.substring(0, 10)}...${secret.substring(secret.length - 10)}`,
    payloadLength: payloadString.length,
    payloadStart: payloadString.substring(0, 50),
    payloadEnd: payloadString.substring(payloadString.length - 50),
  });

  // Try the standard method
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    const result = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    if (!result) {
      // Try without sk_ prefix as fallback
      if (secret.startsWith('sk_')) {
        const altSignature = crypto
          .createHmac('sha256', secret.slice(3))
          .update(payloadString)
          .digest('hex');
        
        const altResult = crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(altSignature, 'hex')
        );
        
        if (altResult) {
          console.log('Webhook signature verified using secret without sk_ prefix');
          return true;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}