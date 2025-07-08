import * as crypto from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

/**
 * Verifies a Slack request using the signing secret
 * @param req - Vercel request object
 * @param signingSecret - Slack signing secret
 * @returns Promise resolving to true if request is valid
 */
export async function verifySlackRequest(
  req: VercelRequest,
  signingSecret: string
): Promise<boolean> {
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;

  if (!signature || !timestamp) {
    console.error('Missing Slack signature or timestamp headers');
    return false;
  }

  // Validate timestamp format
  const timestampNumber = parseInt(timestamp, 10);
  if (isNaN(timestampNumber)) {
    console.error('Invalid Slack timestamp format');
    return false;
  }

  // Check timestamp (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestampNumber) > 300) {
    console.error('Slack request timestamp too old or too far in the future');
    return false;
  }

  // Create signature base string
  // For URL-encoded form data from Slack, we need the raw body string
  let rawBody: string;
  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (req.body && typeof req.body === 'object') {
    // If body is already parsed, we need to reconstruct it
    // This handles both JSON and URL-encoded bodies
    try {
      if (req.headers['content-type']?.includes('application/json')) {
        rawBody = JSON.stringify(req.body);
      } else {
        // URL-encoded form data
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.body)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        rawBody = params.toString();
      }
    } catch (error) {
      console.error('Failed to reconstruct request body:', error);
      return false;
    }
  } else {
    rawBody = '';
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;

  // Calculate expected signature
  const mySignature =
    'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

  // Compare signatures using timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch (error) {
    // Signatures have different lengths or encoding issues
    console.error('Signature comparison failed:', error);
    return false;
  }
}

/**
 * Verifies a Slack signature for a given body and timestamp
 * @param signingSecret - Slack signing secret
 * @param signature - The signature from X-Slack-Signature header
 * @param timestamp - The timestamp from X-Slack-Request-Timestamp header
 * @param body - The raw request body string
 * @returns true if signature is valid
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Validate inputs
  if (!signingSecret || !signature || !timestamp || body === null || body === undefined) {
    console.error('Missing required parameters for Slack signature verification');
    return false;
  }

  // Validate timestamp format
  const timestampNumber = parseInt(timestamp, 10);
  if (isNaN(timestampNumber)) {
    console.error('Invalid Slack timestamp format');
    return false;
  }

  // Check timestamp (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestampNumber) > 300) {
    console.error('Slack request timestamp too old or too far in the future');
    return false;
  }

  // Validate signature format (should start with v0=)
  if (!signature.startsWith('v0=')) {
    console.error('Invalid Slack signature format');
    return false;
  }

  // Create signature base string
  const sigBasestring = `v0:${timestamp}:${body}`;

  // Calculate expected signature
  const mySignature =
    'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

  // Compare signatures using timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch (error) {
    // Signatures have different lengths or encoding issues
    console.error('Signature comparison failed:', error);
    return false;
  }
}
