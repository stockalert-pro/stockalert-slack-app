import { Request, Response } from 'express';
import { App } from '@slack/bolt';
import { AlertEventSchema, SlackMessageOptions } from '../types';
import { verifyWebhookSignature, parseWebhookHeaders } from '../utils/signature';
import { formatAlertMessage, formatErrorMessage } from '../utils/formatter';
import { Config } from '../types';

export class WebhookHandler {
  constructor(
    private app: App,
    private config: Config
  ) {}

  /**
   * Handle incoming webhook from StockAlert.pro
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Parse headers
      const headers = parseWebhookHeaders(req.headers as Record<string, string | string[] | undefined>);

      // Verify signature
      if (!headers.signature) {
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      const payload = req.body;
      const isValid = verifyWebhookSignature(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
        headers.signature,
        this.config.stockalert.webhookSecret
      );

      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse and validate event
      const parseResult = AlertEventSchema.safeParse(payload);
      if (!parseResult.success) {
        console.error('Invalid webhook payload:', parseResult.error);
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }

      const event = parseResult.data;

      // Handle different event types
      switch (event.type) {
        case 'alert.triggered':
          await this.handleAlertTriggered(event);
          break;
        case 'alert.created':
        case 'alert.updated':
        case 'alert.deleted':
          // These events can be handled later if needed
          console.log(`Received ${event.type} event for alert ${event.data.alert.id}`);
          break;
        default:
          console.warn(`Unknown event type: ${event.type}`);
      }

      // Acknowledge webhook
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle alert triggered event
   */
  private async handleAlertTriggered(event: any): Promise<void> {
    try {
      const { text, blocks } = formatAlertMessage(event);
      const channel = this.config.slack.defaultChannel || '#general';

      await this.app.client.chat.postMessage({
        token: this.config.slack.botToken,
        channel,
        text,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });

      console.log(`Posted alert to ${channel} for ${event.data.alert.symbol}`);
    } catch (error) {
      console.error('Failed to post message to Slack:', error);
      throw error;
    }
  }

  /**
   * Send test message
   */
  async sendTestMessage(channel: string): Promise<void> {
    try {
      const { text, blocks } = formatTestMessage();

      await this.app.client.chat.postMessage({
        token: this.config.slack.botToken,
        channel,
        text,
        blocks,
      });
    } catch (error) {
      console.error('Failed to send test message:', error);
      throw error;
    }
  }
}

// Helper function for test message
function formatTestMessage(): { text: string; blocks: any[] } {
  return {
    text: '✅ StockAlert.pro Slack integration is working!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *StockAlert.pro Slack Integration*\n\nYour Slack app is successfully connected and ready to receive webhook notifications!',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Tested at ${new Date().toLocaleString()}`,
          },
        ],
      },
    ],
  };
}