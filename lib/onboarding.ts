import { WebClient, ModalView, Block, KnownBlock } from '@slack/web-api';
import { installationRepo, channelRepo } from './db/repositories';

interface OnboardingStatus {
  hasApiKey: boolean;
  hasDefaultChannel: boolean;
  hasWebhook: boolean;
  hasReceivedAlert: boolean;
}

export async function getOnboardingStatus(teamId: string): Promise<OnboardingStatus> {
  const installation = await installationRepo.findByTeamId(teamId);
  const defaultChannel = await channelRepo.findDefaultChannel(teamId);

  return {
    hasApiKey: !!installation?.stockalertApiKey,
    hasDefaultChannel: !!defaultChannel,
    hasWebhook: !!installation?.stockalertWebhookId,
    hasReceivedAlert: false, // TODO: Track this in webhook_events
  };
}

export async function sendWelcomeMessage(
  client: WebClient,
  teamId: string,
  userId: string,
  channelId?: string
) {
  const status = await getOnboardingStatus(teamId);

  // Send DM to installing user
  const dm = await client.conversations.open({ users: userId });

  if (!dm.ok || !dm.channel?.id) {
    throw new Error('Failed to open DM with user');
  }

  await client.chat.postMessage({
    channel: dm.channel.id,
    text: "👋 Welcome to StockAlert.pro for Slack! Let's get you set up.",
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '👋 Welcome to StockAlert.pro for Slack!',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "I'll help you get set up in just 3 easy steps. Let's get started!",
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*Step 1: Choose a channel for alerts* ${status.hasDefaultChannel ? '✅' : '⏳'}\n` +
            `Pick where you'd like to receive stock alerts.`,
        },
        accessory: status.hasDefaultChannel
          ? undefined
          : {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Choose Channel',
              },
              action_id: 'select_channel',
              style: 'primary',
            },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*Step 2: Connect your StockAlert.pro account* ${status.hasApiKey ? '✅' : '⏳'}\n` +
            `Link your StockAlert.pro account to start receiving alerts.`,
        },
        accessory: status.hasApiKey
          ? undefined
          : {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Connect Account',
              },
              action_id: 'connect_stockalert',
              style: 'primary',
            },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*Step 3: Test your setup* ${status.hasReceivedAlert ? '✅' : '⏳'}\n` +
            `Send a test alert to make sure everything works.`,
        },
        accessory: status.hasWebhook
          ? {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Send Test Alert',
              },
              action_id: 'send_test_alert',
            }
          : undefined,
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Need help? Type `/stockalert help` in any channel or visit our <https://stockalert.pro/docs|documentation>.',
          },
        ],
      },
    ],
  });

  // If all steps completed, send success message
  if (status.hasApiKey && status.hasDefaultChannel && status.hasWebhook) {
    await client.chat.postMessage({
      channel: channelId || dm.channel.id,
      text: '🎉 StockAlert.pro is now connected to this Slack workspace!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🎉 *StockAlert.pro is now connected!*\n\nYour stock alerts will appear here automatically.',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Dashboard',
              },
              url: 'https://stockalert.pro/dashboard',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Create Alert',
              },
              url: 'https://stockalert.pro/dashboard',
            },
          ],
        },
      ],
    });
  }
}

export function getChannelSelectionModal(): ModalView {
  return {
    type: 'modal' as const,
    callback_id: 'channel_selection',
    title: {
      type: 'plain_text' as const,
      text: 'Choose Alert Channel',
    },
    submit: {
      type: 'plain_text' as const,
      text: 'Save',
    },
    blocks: [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: 'Select the channel where you want to receive StockAlert.pro notifications:',
        },
      },
      {
        type: 'input' as const,
        block_id: 'channel_select',
        label: {
          type: 'plain_text' as const,
          text: 'Channel',
        },
        element: {
          type: 'channels_select' as const,
          action_id: 'selected_channel',
          placeholder: {
            type: 'plain_text' as const,
            text: 'Select a channel',
          },
        },
      },
    ],
  };
}

export function getApiKeyModal(): ModalView {
  return {
    type: 'modal' as const,
    callback_id: 'api_key_input',
    title: {
      type: 'plain_text' as const,
      text: 'Connect StockAlert.pro',
    },
    submit: {
      type: 'plain_text' as const,
      text: 'Connect',
    },
    blocks: [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text:
            '*To connect your StockAlert.pro account:*\n\n' +
            '1. Go to <https://stockalert.pro/dashboard/settings|Settings> in your dashboard\n' +
            '2. Click "Generate New API Key"\n' +
            '3. Copy the key and paste it below',
        },
      },
      {
        type: 'divider' as const,
      },
      {
        type: 'input' as const,
        block_id: 'api_key_input',
        label: {
          type: 'plain_text' as const,
          text: 'API Key',
        },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'api_key',
          placeholder: {
            type: 'plain_text' as const,
            text: 'sk_your_api_key_here',
          },
        },
        hint: {
          type: 'plain_text' as const,
          text: 'Your API key starts with sk_ and is kept secure',
        },
      },
    ],
  };
}

export function getOnboardingProgressMessage(status: OnboardingStatus): {
  blocks: (KnownBlock | Block)[];
} {
  const steps = [
    {
      name: 'Channel selected',
      completed: status.hasDefaultChannel,
      emoji: status.hasDefaultChannel ? '✅' : '⭕',
    },
    {
      name: 'StockAlert.pro connected',
      completed: status.hasApiKey,
      emoji: status.hasApiKey ? '✅' : '⭕',
    },
    {
      name: 'Webhook configured',
      completed: status.hasWebhook,
      emoji: status.hasWebhook ? '✅' : '⭕',
    },
  ];

  const completedSteps = steps.filter((s) => s.completed).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Setup Progress: ${progress}%*\n\n${steps.map((s) => `${s.emoji} ${s.name}`).join('\n')}`,
        },
      },
      completedSteps < steps.length
        ? {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Continue Setup',
                },
                action_id: 'continue_onboarding',
                style: 'primary',
              },
            ],
          }
        : {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎉 *All set!* Your StockAlert.pro integration is ready.',
            },
          },
    ].filter(Boolean) as (KnownBlock | Block)[],
  };
}
