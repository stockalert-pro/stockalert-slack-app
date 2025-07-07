import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySlackRequest } from '../../lib/slack-verify';
import { handleSlashCommand } from '../../lib/handlers/commands';

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