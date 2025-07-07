import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySlackRequest } from '../../lib/slack-verify';
import { handleSlashCommand } from '../../lib/handlers/commands';
import { commandRateLimiter } from '../../lib/rate-limiter';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Slack signature
    const isValid = await verifySlackRequest(req, process.env.SLACK_SIGNING_SECRET!);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse command
    const command = req.body;

    // Apply rate limiting per user
    const rateLimitResult = await commandRateLimiter.check(`${command.team_id}:${command.user_id}`);
    
    if (!rateLimitResult.success) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '⚠️ Too many commands. Please wait a moment before trying again.'
      });
    }

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