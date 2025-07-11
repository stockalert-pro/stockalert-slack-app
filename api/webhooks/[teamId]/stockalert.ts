import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyWebhookSignature } from '../../../lib/webhook-verify';
import { postToSlack } from '../../../lib/slack-client';
import { formatAlertMessage } from '../../../lib/formatter';
import { AlertEventSchema } from '../../../lib/types';
import { webhookEventRepo, installationRepo } from '../../../lib/db/repositories';
import { z } from 'zod';
import { Monitor, measureAsync } from '../../../lib/monitoring';
import { installationCache } from '../../../lib/cache';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const monitor = Monitor.getInstance();
  const startTime = Date.now();
  const teamId = (req.query.teamId as string) || '';

  // Log all webhook requests
  console.log(`Webhook ${req.method} request for team ${teamId}`, {
    headers: req.headers['user-agent'],
    referer: req.headers['referer'],
    origin: req.headers['origin'],
  });

  // Track webhook request
  monitor.incrementCounter('webhook.requests', 1, {
    method: req.method || 'unknown',
    team: teamId || 'unknown',
  });

  if (req.method === 'GET') {
    // Return info for GET requests (useful for debugging)
    return res.status(200).json({
      message: 'StockAlert webhook endpoint',
      method: 'POST required',
      team: req.query.teamId,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!teamId) {
    monitor.incrementCounter('webhook.errors', 1, { type: 'missing_team_id' });
    return res.status(400).json({ error: 'Missing teamId parameter' });
  }

  try {
    // Get raw body with performance tracking
    const rawBody = await measureAsync('webhook.getRawBody', () => getRawBody(req), {
      team: teamId,
    });

    // Parse JSON body with error handling
    let body;
    try {
      body = JSON.parse(rawBody.toString());
    } catch {
      console.error('Invalid JSON in webhook payload');
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Verify installation exists (with caching)
    const installation = await measureAsync(
      'webhook.getInstallation',
      async () => {
        // Try cache first
        const cached = await installationCache.getInstallation(teamId);
        if (cached) {
          monitor.incrementCounter('webhook.cache.hits', 1, { type: 'installation' });
          return cached;
        }

        // Cache miss - fetch from DB
        monitor.incrementCounter('webhook.cache.misses', 1, { type: 'installation' });
        const inst = await installationRepo.findByTeamId(teamId);

        if (inst) {
          // Cache for future requests
          await installationCache.setInstallation(teamId, inst);
        }

        return inst;
      },
      { team: teamId }
    );

    if (!installation) {
      monitor.incrementCounter('webhook.errors', 1, { type: 'installation_not_found' });
      return res.status(404).json({ error: 'Installation not found' });
    }

    // Verify StockAlert signature - check multiple possible headers
    const signatureHeader =
      req.headers['x-stockalert-signature'] ||
      req.headers['x-signature'] ||
      req.headers['x-webhook-signature'];

    // Handle both string and array types from headers
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

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

    // Log webhook receipt with full data for debugging
    console.log(`Webhook received for team ${teamId}:`, {
      event: body.event,
      symbol: body.data?.symbol,
      alertId: body.data?.alert_id,
      timestamp: body.timestamp,
      condition: body.data?.condition,
      threshold: body.data?.threshold,
      current_value: body.data?.current_value,
      // Log any additional fields that might be present
      price: body.data?.price,
      forward_pe: body.data?.forward_pe,
      pe_ratio: body.data?.pe_ratio,
      actual_value: body.data?.actual_value,
    });

    // Get webhook secret for this team (from API integration or fallback to global)
    const webhookSecret =
      installation.stockalertWebhookSecret || process.env.STOCKALERT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('No webhook secret configured for team', teamId);
      return res
        .status(503)
        .json({ error: 'Webhook not configured. Please run /stockalert apikey <your-api-key>' });
    }

    // The signature can come in different formats:
    // - With prefix: "sha256=abc123..."
    // - Without prefix: "abc123..."
    // verifyWebhookSignature handles both formats
    const isValid = await measureAsync(
      'webhook.verifySignature',
      () => Promise.resolve(verifyWebhookSignature(rawBody, signature, webhookSecret)),
      { team: teamId }
    );

    if (!isValid) {
      console.error('Signature verification failed');
      monitor.incrementCounter('webhook.errors', 1, { type: 'invalid_signature' });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse and validate event
    const event = AlertEventSchema.parse(body);

    // Generate unique event ID from alert_id and timestamp
    const eventId = `${event.data.alert_id}-${event.timestamp}`;

    // Store webhook event for idempotency and audit trail
    const webhookEvent = await measureAsync(
      'webhook.storeEvent',
      () =>
        webhookEventRepo.create({
          eventId: eventId,
          teamId: teamId,
          eventType: event.event,
          payload: event as any,
        }),
      { team: teamId }
    );

    // If this is a duplicate event, return success without processing
    if (!webhookEvent) {
      console.log(`Duplicate event ${eventId} for team ${teamId}, skipping`);
      return res.status(200).json({ success: true, duplicate: true });
    }

    // Handle alert triggered events
    if (event.event === 'alert.triggered') {
      const { text, blocks } = formatAlertMessage(event);

      // Post to Slack with team context
      await measureAsync(
        'webhook.postToSlack',
        () =>
          postToSlack({
            channel: '', // Will use default channel from DB
            text,
            blocks,
            teamId,
          }),
        { team: teamId }
      );

      // Mark event as processed
      await measureAsync('webhook.markProcessed', () => webhookEventRepo.markProcessed(eventId), {
        team: teamId,
      });

      monitor.incrementCounter('webhook.alerts.processed', 1, {
        team: teamId,
        symbol: event.data.symbol,
        condition: event.data.condition,
      });
    }

    // Record total processing time
    const totalTime = Date.now() - startTime;
    monitor.recordHistogram('webhook.totalTime', totalTime, {
      team: teamId,
      status: 'success',
    });

    monitor.incrementCounter('webhook.success', 1, { team: teamId });

    return res.status(200).json({ success: true });
  } catch (error) {
    // Log detailed error for debugging
    console.error('Webhook error:', {
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Record total processing time with error
    const totalTime = Date.now() - startTime;
    monitor.recordHistogram('webhook.totalTime', totalTime, {
      team: teamId,
      status: 'error',
    });

    // Return appropriate error based on the type
    if (error instanceof z.ZodError) {
      monitor.incrementCounter('webhook.errors', 1, { type: 'validation_error' });
      return res.status(400).json({
        error: 'Invalid webhook payload',
        details: error.errors,
      });
    }

    monitor.incrementCounter('webhook.errors', 1, { type: 'internal_error' });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
