import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyWebhookSignature } from '../../../lib/webhook-verify';
import { postToSlack } from '../../../lib/slack-client';
import { formatAlertMessage } from '../../../lib/formatter';
import { AlertEventSchema } from '../../../lib/types';
import { webhookEventRepo, installationRepo } from '../../../lib/db/repositories';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const teamId = req.query.teamId as string;
  if (!teamId) {
    return res.status(400).json({ error: 'Missing teamId parameter' });
  }

  try {
    // Verify installation exists
    const installation = await installationRepo.findByTeamId(teamId);
    if (!installation) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    // Verify StockAlert signature - check multiple possible headers
    const signature = req.headers['x-stockalert-signature'] 
      || req.headers['x-signature'] 
      || req.headers['x-webhook-signature'] as string;
    
    // Debug logging
    console.log('Webhook headers:', {
      'x-stockalert-signature': req.headers['x-stockalert-signature'],
      'x-signature': req.headers['x-signature'],
      'x-webhook-signature': req.headers['x-webhook-signature'],
      'content-type': req.headers['content-type'],
    });
    
    if (!signature) {
      console.error('No signature header found');
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Debug: Log request body
    console.log('Request body:', JSON.stringify(req.body));
    console.log('Signature:', signature);
    console.log('Secret exists:', !!process.env.STOCKALERT_WEBHOOK_SECRET);
    console.log('Secret length:', process.env.STOCKALERT_WEBHOOK_SECRET?.length);
    
    const isValid = verifyWebhookSignature(
      JSON.stringify(req.body),
      signature as string,
      process.env.STOCKALERT_WEBHOOK_SECRET!
    );

    if (!isValid) {
      console.error('Signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse and validate event
    const event = AlertEventSchema.parse(req.body);

    // Generate unique event ID from alert_id and timestamp
    const eventId = `${event.data.alert_id}-${event.timestamp}`;
    
    // Store webhook event for idempotency and audit trail
    const webhookEvent = await webhookEventRepo.create({
      eventId: eventId,
      teamId: teamId,
      eventType: event.event,
      payload: event as any,
    });

    // If this is a duplicate event, return success without processing
    if (!webhookEvent) {
      console.log(`Duplicate event ${eventId} for team ${teamId}, skipping`);
      return res.status(200).json({ success: true, duplicate: true });
    }

    // Handle alert triggered events
    if (event.event === 'alert.triggered') {
      const { text, blocks } = formatAlertMessage(event);
      
      // Post to Slack with team context
      await postToSlack({
        channel: '', // Will use default channel from DB
        text,
        blocks,
        teamId,
      });

      // Mark event as processed
      await webhookEventRepo.markProcessed(eventId);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}