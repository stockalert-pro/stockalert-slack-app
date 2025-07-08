import { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { handleSlashCommand } from '../../lib/handlers/commands';
import type { SlashCommand } from '../../lib/handlers/commands';

// Constants
const SLACK_TIMESTAMP_WINDOW_SECONDS = 5 * 60; // 5 minutes
const MAX_BODY_SIZE = 1024 * 100; // 100KB max body size

// Validate environment variables at module load
if (!process.env['SLACK_SIGNING_SECRET']) {
  console.warn('Warning: SLACK_SIGNING_SECRET not configured');
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;

    // Set a timeout to prevent hanging requests
    const timeout = setTimeout(() => {
      req.removeAllListeners();
      reject(new Error('Request timeout'));
    }, 10000); // 10 second timeout

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;

      // Prevent DoS by limiting body size
      if (size > MAX_BODY_SIZE) {
        clearTimeout(timeout);
        req.removeAllListeners();
        reject(new Error('Request body too large'));
        return;
      }

      data += chunk.toString('utf8');
    });

    req.on('end', () => {
      clearTimeout(timeout);
      resolve(data);
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string
): boolean {
  // Check timestamp (within configured window)
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);

  if (isNaN(requestTime)) {
    return false;
  }

  if (Math.abs(currentTime - requestTime) > SLACK_TIMESTAMP_WINDOW_SECONDS) {
    return false;
  }

  // Create signature base string
  const sigBasestring = `v0:${timestamp}:${rawBody}`;

  // Calculate expected signature
  const mySignature =
    'v0=' + createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

  // Compare signatures using timing-safe comparison
  try {
    return timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    // Buffer lengths don't match
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  // Only POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validate content type
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('application/x-www-form-urlencoded')) {
    res.status(415).json({ error: 'Unsupported Media Type' });
    return;
  }

  try {
    // Extract and validate headers
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signingSecret = process.env['SLACK_SIGNING_SECRET'];

    // Ensure headers are strings (not arrays)
    if (typeof signature !== 'string' || typeof timestamp !== 'string') {
      console.error('Invalid header format');
      res.status(400).json({ error: 'Bad Request' });
      return;
    }

    if (!signingSecret) {
      console.error('Missing signing secret configuration');
      res.status(500).json({ error: 'Server misconfiguration' });
      return;
    }

    // Get raw body for signature verification
    const rawBody = await getRawBody(req);

    // Verify signature
    const isValid = verifySlackSignature(signingSecret, signature, timestamp, rawBody);
    if (!isValid) {
      console.error('Invalid signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Parse the body with proper typing
    const params = new URLSearchParams(rawBody);
    const command: SlashCommand = {
      token: params.get('token') || '',
      team_id: params.get('team_id') || '',
      team_domain: params.get('team_domain') || '',
      channel_id: params.get('channel_id') || '',
      channel_name: params.get('channel_name') || '',
      user_id: params.get('user_id') || '',
      user_name: params.get('user_name') || '',
      command: params.get('command') || '',
      text: params.get('text') || '',
      response_url: params.get('response_url') || '',
    };

    // Validate required fields
    if (!command.team_id || !command.user_id || !command.channel_id) {
      console.error('Missing required command fields');
      res.status(400).json({
        response_type: 'ephemeral',
        text: 'Invalid command format',
      });
      return;
    }

    // Sanitize text input to prevent injection attacks
    command.text = command.text.slice(0, 1000).trim(); // Limit command text length and trim whitespace

    // Additional validation for specific fields
    const teamIdPattern = /^T[A-Z0-9]+$/;
    const userIdPattern = /^U[A-Z0-9]+$/;
    const channelIdPattern = /^[CDG][A-Z0-9]+$/;

    if (
      !teamIdPattern.test(command.team_id) ||
      !userIdPattern.test(command.user_id) ||
      !channelIdPattern.test(command.channel_id)
    ) {
      console.error('Invalid Slack ID format');
      res.status(400).json({
        response_type: 'ephemeral',
        text: 'Invalid request format',
      });
      return;
    }

    // Handle command
    const response = await handleSlashCommand(command);

    // Send response to Slack
    res.status(200).json(response);
  } catch (error) {
    // Log full error for debugging
    console.error('Command handler error:', error);

    // Determine appropriate error response
    let statusCode = 500;
    let errorMessage = 'An error occurred processing your command.';

    if (error instanceof Error) {
      if (error.message === 'Request body too large') {
        statusCode = 413;
        errorMessage = 'Request too large';
      } else if (error.message.includes('Invalid') || error.message.includes('validation')) {
        statusCode = 400;
        errorMessage = 'Invalid request';
      }
    }

    // Send error response
    res.status(statusCode).json({
      response_type: 'ephemeral',
      text: `❌ ${errorMessage}`,
    });
  }
}
