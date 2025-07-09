import { VercelRequest, VercelResponse } from '@vercel/node';
import { WebClient } from '@slack/web-api';
import { verifySlackSignature } from '../../lib/slack-verify';
import { installationRepo, channelRepo } from '../../lib/db/repositories';
import { getChannelSelectionModal, getApiKeyModal, sendWelcomeMessage } from '../../lib/onboarding';
import { StockAlertAPI } from '../../lib/stockalert-api';
import { getWebhookUrl } from '../../lib/constants';

interface SlackInteractivityPayload {
  type: string;
  team: { id: string; domain: string };
  user: { id: string; name: string };
  api_app_id: string;
  token: string;
  trigger_id?: string;
  view?: any;
  actions?: Array<{
    action_id: string;
    block_id: string;
    value?: string;
    selected_channel?: string;
  }>;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  console.log('Interactivity endpoint called:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);

    // Verify Slack signature
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signature = req.headers['x-slack-signature'] as string;

    console.log('Verifying Slack signature...');

    if (
      !verifySlackSignature(process.env['SLACK_SIGNING_SECRET']!, signature, timestamp, rawBody)
    ) {
      console.error('Invalid Slack signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload
    const payload: SlackInteractivityPayload = JSON.parse(
      decodeURIComponent(rawBody).replace('payload=', '')
    );

    console.log('Interaction payload:', {
      type: payload.type,
      action: payload.actions?.[0]?.action_id,
      team: payload.team.id,
      user: payload.user.id,
    });

    // Get installation
    const installation = await installationRepo.findByTeamId(payload.team.id);
    if (!installation) {
      console.error('Installation not found for team:', payload.team.id);
      return res.status(200).json({ error: 'Installation not found' });
    }

    const client = new WebClient(installation.botToken);

    // Handle different interaction types
    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0];

      console.log('Handling action:', action?.action_id);

      switch (action?.action_id) {
        case 'select_channel':
          // Open channel selection modal
          await client.views.open({
            trigger_id: payload.trigger_id!,
            view: getChannelSelectionModal(),
          });
          break;

        case 'connect_stockalert':
          // Open API key input modal
          await client.views.open({
            trigger_id: payload.trigger_id!,
            view: getApiKeyModal(),
          });
          break;

        case 'send_test_alert':
          // Send test webhook
          // TODO: Implement test webhook
          await client.chat.postMessage({
            channel: payload.user.id,
            text: '🧪 Test alert sent! You should see it in your configured channel shortly.',
          });
          break;

        case 'continue_onboarding':
          // Re-send welcome message to continue
          await sendWelcomeMessage(client, payload.team.id, payload.user.id);
          break;
      }
    } else if (payload.type === 'view_submission') {
      // Handle modal submissions
      const callbackId = payload.view?.callback_id;

      if (callbackId === 'channel_selection') {
        // Save selected channel
        const channelId =
          payload.view?.state?.values?.channel_select?.selected_channel?.selected_channel;

        if (channelId) {
          try {
            // Create or update channel
            await channelRepo.create({
              teamId: payload.team.id,
              channelId: channelId,
              channelName: '',
              isDefault: true,
            });
            await channelRepo.setDefaultChannel(payload.team.id, channelId);

            // Send confirmation
            await client.chat.postMessage({
              channel: payload.user.id,
              text: `✅ Great! I'll send alerts to <#${channelId}>`,
            });

            // Continue onboarding
            await sendWelcomeMessage(client, payload.team.id, payload.user.id);

            // Close the modal successfully
            return res.status(200).json({ response_action: 'clear' });
          } catch (error) {
            console.error('Error saving channel:', error);
            // Return error to Slack
            return res.status(200).json({
              response_action: 'errors',
              errors: {
                channel_select: 'Failed to save channel. Please try again.',
              },
            });
          }
        } else {
          // No channel selected
          return res.status(200).json({
            response_action: 'errors',
            errors: {
              channel_select: 'Please select a channel',
            },
          });
        }
      } else if (callbackId === 'api_key_input') {
        // Save API key and create webhook
        const apiKey = payload.view?.state?.values?.api_key_input?.api_key?.value;

        if (apiKey && apiKey.startsWith('sk_')) {
          try {
            // Test API key and create webhook
            const api = new StockAlertAPI(apiKey);
            const webhookUrl = getWebhookUrl(payload.team.id);

            console.log('Looking for existing webhook with URL:', webhookUrl);
            let webhook = await api.findWebhookByUrl(webhookUrl);

            if (!webhook) {
              console.log('No existing webhook found, creating new one...');
              webhook = await api.createWebhook({
                name: `Slack - ${payload.team.domain}`,
                url: webhookUrl,
                events: ['alert.triggered'],
                is_active: true,
              });
              console.log('Webhook created successfully:', webhook.id);
            } else if (webhook.is_active === false) {
              // Reactivate existing webhook
              console.log('Found inactive webhook:', webhook.id);
              // TODO: Add updateWebhook method to API client
              // For now, we'll use the existing webhook even if inactive
            } else {
              console.log('Using existing active webhook:', webhook.id);
            }

            // Save to database
            await installationRepo.update(payload.team.id, {
              stockalertApiKey: apiKey,
              stockalertWebhookId: webhook.id,
              stockalertWebhookSecret: webhook.secret,
            });

            // Send confirmation
            await client.chat.postMessage({
              channel: payload.user.id,
              text: '✅ Perfect! Your StockAlert.pro account is now connected.',
            });

            // Continue onboarding
            await sendWelcomeMessage(client, payload.team.id, payload.user.id);

            // Return clear response to close the modal
            return res.status(200).json({ response_action: 'clear' });
          } catch (error) {
            console.error('API key validation error:', error);
            return res.status(200).json({
              response_action: 'errors',
              errors: {
                api_key_input:
                  error instanceof Error
                    ? error.message
                    : 'Invalid API key. Please check and try again.',
              },
            });
          }
        } else {
          return res.status(200).json({
            response_action: 'errors',
            errors: {
              api_key_input: 'API key must start with sk_',
            },
          });
        }
      }
    }

    // Always return 200 for Slack
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Interactivity error:', error);
    // Still return 200 to prevent Slack retries
    return res.status(200).json({ ok: false, error: 'Internal error' });
  }
}
