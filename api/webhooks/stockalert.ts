import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyWebhookSignature } from '../../lib/webhook-verify';
import { postToSlack } from '../../lib/slack-client';
import { formatAlertMessage } from '../../lib/formatter';
import { AlertEventSchema } from '../../lib/types';

// Legacy webhook endpoint - use /api/webhooks/[teamId]/stockalert for production
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if teamId is provided as query parameter
  const teamId = req.query.teamId as string;
  if (teamId) {
    // Redirect to the new endpoint
    res.setHeader('Location', `/api/webhooks/${teamId}/stockalert`);
    return res.status(307).end();
  }

  try {
    // Verify StockAlert signature - check multiple possible headers
    const signature = req.headers['x-stockalert-signature'] 
      || req.headers['x-signature'] 
      || req.headers['x-webhook-signature'] as string;
    
    // Debug logging
    console.log('Legacy webhook headers:', {
      'x-stockalert-signature': req.headers['x-stockalert-signature'],
      'x-signature': req.headers['x-signature'],
      'x-webhook-signature': req.headers['x-webhook-signature'],
      'all-headers': Object.keys(req.headers),
    });
    
    if (!signature) {
      console.error('No signature header found in legacy endpoint');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const isValid = verifyWebhookSignature(
      JSON.stringify(req.body),
      signature as string,
      process.env.STOCKALERT_WEBHOOK_SECRET!
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse and validate event
    const event = AlertEventSchema.parse(req.body);

    // Handle alert triggered events
    if (event.type === 'alert.triggered') {
      const { text, blocks } = formatAlertMessage(event);
      
      // Post to Slack (fallback for development - uses env vars)
      await postToSlack({
        channel: process.env.DEFAULT_SLACK_CHANNEL || '#general',
        text,
        blocks,
      });
    }

    res.status(200).json({ 
      success: true,
      warning: 'This endpoint is deprecated. Use /api/webhooks/{teamId}/stockalert instead.'
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}