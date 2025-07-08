import * as crypto from 'crypto';
import { VercelRequest } from '@vercel/node';

export async function verifySlackRequest(
  req: VercelRequest,
  signingSecret: string
): Promise<boolean> {
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;

  if (!signature || !timestamp) {
    return false;
  }

  // Check timestamp (within 5 minutes)
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    return false;
  }

  // Create signature base string
  // For URL-encoded form data from Slack, we need the raw body string
  let rawBody: string;
  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (req.body && typeof req.body === 'object') {
    // If body is already parsed, we need to reconstruct it
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.body)) {
      params.append(key, String(value));
    }
    rawBody = params.toString();
  } else {
    rawBody = '';
  }
  
  const sigBasestring = `v0:${timestamp}:${rawBody}`;

  // Calculate expected signature
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Validate inputs
  if (!signingSecret || !signature || !timestamp || !body) {
    console.error('Missing required parameters for Slack signature verification');
    return false;
  }

  // Check timestamp (within 5 minutes)
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    console.error('Slack request timestamp too old');
    return false;
  }

  // Create signature base string
  const sigBasestring = `v0:${timestamp}:${body}`;

  // Calculate expected signature
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  // Compare signatures
  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (error) {
    console.error('Signature comparison failed:', error);
    return false;
  }
}