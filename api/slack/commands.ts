import { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { handleSlashCommand } from '../../lib/handlers/commands';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string
): boolean {
  // Check timestamp (within 5 minutes)
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    return false;
  }

  // Create signature base string
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (!signature || !timestamp || !signingSecret) {
      console.error('Missing required headers or signing secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Verify signature
    const isValid = verifySlackSignature(signingSecret, signature, timestamp, rawBody);
    if (!isValid) {
      console.error('Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the body
    const params = new URLSearchParams(rawBody);
    const command = Object.fromEntries(params.entries());

    // Handle command
    const response = await handleSlashCommand(command);

    // Send response to Slack
    res.status(200).json(response);
  } catch (error) {
    console.error('Command error:', error);
    res.status(500).json({ 
      response_type: 'ephemeral',
      text: '❌ An error occurred processing your command.' 
    });
  }
}