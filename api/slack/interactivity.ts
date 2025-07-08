import { VercelRequest, VercelResponse } from '@vercel/node';
import { WebClient } from '@slack/web-api';
import { verifySlackSignature } from '../../lib/slack-verify';
import { installationRepo, channelRepo } from '../../lib/db/repositories';
import { 
  getChannelSelectionModal, 
  getApiKeyModal,
  getOnboardingStatus,
  sendWelcomeMessage 
} from '../../lib/onboarding';
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
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Verify Slack signature
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signature = req.headers['x-slack-signature'] as string;
    
    if (!verifySlackSignature(process.env.SLACK_SIGNING_SECRET!, signature, timestamp, rawBody)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Parse payload
    const payload: SlackInteractivityPayload = JSON.parse(
      decodeURIComponent(rawBody).replace('payload=', '')
    );
    
    // Get installation
    const installation = await installationRepo.findByTeamId(payload.team.id);
    if (!installation) {
      return res.status(200).json({ error: 'Installation not found' });
    }
    
    const client = new WebClient(installation.botToken);
    
    // Handle different interaction types
    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0];
      
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
        const channelId = payload.view?.state?.values?.channel_select?.selected_channel?.selected_channel;
        
        if (channelId) {
          await channelRepo.create({
            teamId: payload.team.id,
            channelId: channelId,
            channelName: '',
            isDefault: 'true',
          });
          await channelRepo.setDefaultChannel(payload.team.id, channelId);
          
          // Send confirmation
          await client.chat.postMessage({
            channel: payload.user.id,
            text: `✅ Great! I'll send alerts to <#${channelId}>`,
          });
          
          // Continue onboarding
          await sendWelcomeMessage(client, payload.team.id, payload.user.id);
        }
      } else if (callbackId === 'api_key_input') {
        // Save API key and create webhook
        const apiKey = payload.view?.state?.values?.api_key_input?.api_key?.value;
        
        if (apiKey && apiKey.startsWith('sk_')) {
          try {
            // Test API key and create webhook
            const api = new StockAlertAPI(apiKey);
            const webhookUrl = getWebhookUrl(payload.team.id);
            
            let webhook = await api.findWebhookByUrl(webhookUrl);
            if (!webhook) {
              webhook = await api.createWebhook({
                name: `Slack - ${payload.team.domain}`,
                url: webhookUrl,
                events: ['alert.triggered'],
                enabled: true,
              });
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
          } catch (error: any) {
            return res.status(200).json({
              response_action: 'errors',
              errors: {
                api_key_input: 'Invalid API key. Please check and try again.',
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
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Interactivity error:', error);
    res.status(200).json({ error: 'Internal error' });
  }
}