import { channelRepo, installationRepo } from '../db/repositories';
import { getWebhookUrl } from '../constants';
import { Block, KnownBlock } from '@slack/web-api';
import { Monitor } from '../monitoring';

export interface SlashCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
}

export async function handleSlashCommand(command: SlashCommand) {
  const monitor = Monitor.getInstance();
  const startTime = Date.now();

  const args = command.text.trim().split(' ');
  const subcommand = args[0]?.toLowerCase() || 'help';

  // Track command usage
  monitor.incrementCounter('slack.commands', 1, {
    team: command.team_id,
    command: subcommand,
  });

  try {
    const result = await handleCommandWithMonitoring(command, subcommand, args);

    // Track success
    const duration = Date.now() - startTime;
    monitor.recordHistogram('slack.command.duration', duration, {
      team: command.team_id,
      command: subcommand,
      status: 'success',
    });

    return result;
  } catch (error) {
    // Track error
    const duration = Date.now() - startTime;
    monitor.recordHistogram('slack.command.duration', duration, {
      team: command.team_id,
      command: subcommand,
      status: 'error',
    });
    monitor.incrementCounter('slack.command.errors', 1, {
      team: command.team_id,
      command: subcommand,
    });

    throw error;
  }
}

async function handleCommandWithMonitoring(
  command: SlashCommand,
  subcommand: string,
  args: string[]
) {
  switch (subcommand) {
    case 'help': {
      // Import onboarding helpers
      const { getOnboardingStatus, getOnboardingProgressMessage } = await import('../onboarding');
      const status = await getOnboardingStatus(command.team_id);

      if (!status.hasApiKey || !status.hasDefaultChannel || !status.hasWebhook) {
        // Show onboarding progress if not fully set up
        const progressMessage = getOnboardingProgressMessage(status);
        return {
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'StockAlert.pro Setup',
              },
            },
            ...progressMessage.blocks,
            {
              type: 'divider',
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text:
                  '*Available Commands:*\n' +
                  '• `/stockalert help` - Show this help\n' +
                  '• `/stockalert status` - Check connection status\n' +
                  '• `/stockalert channel #channel` - Set alert channel\n' +
                  '• `/stockalert apikey <key>` - Connect your account\n' +
                  '• `/stockalert disconnect` - Remove StockAlert.pro connection',
              },
            },
          ],
        };
      }

      // Show regular help for fully set up users
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*StockAlert.pro Slack Commands*',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                '• `/stockalert help` - Show this help message\n' +
                '• `/stockalert test` - Send a test notification\n' +
                '• `/stockalert status` - Show integration status\n' +
                '• `/stockalert channel #channel` - Set notification channel\n' +
                '• `/stockalert apikey <key>` - Update your StockAlert.pro API key\n' +
                '• `/stockalert disconnect` - Remove StockAlert.pro connection',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Need help? Visit <https://stockalert.pro/docs|our documentation>',
              },
            ],
          },
        ],
      };
    }

    case 'test': {
      return {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ *StockAlert.pro Test Message*\n\nYour Slack integration is working correctly! You will receive real-time alerts here when your stock alerts trigger.',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Test requested by <@${command.user_id}> at ${new Date().toLocaleString()}`,
              },
            ],
          },
        ],
      };
    }

    case 'status': {
      const installation = await installationRepo.findByTeamId(command.team_id);
      const defaultChannel = await channelRepo.findDefaultChannel(command.team_id);
      const webhookUrl = getWebhookUrl(command.team_id);

      const statusBlocks: (KnownBlock | Block)[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*StockAlert.pro Integration Status*',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:*\n${installation ? '✅ Connected' : '❌ Not installed'}`,
            },
            {
              type: 'mrkdwn',
              text: '*Workspace:*\n' + command.team_domain,
            },
            {
              type: 'mrkdwn',
              text: `*Default Channel:*\n${defaultChannel ? `<#${defaultChannel.channelId}>` : 'Not set'}`,
            },
            {
              type: 'mrkdwn',
              text: '*User:*\n<@' + command.user_id + '>',
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Webhook URL:*\n\`${webhookUrl}\``,
          },
        },
      ];

      // Add API integration status
      if (installation && installation.stockalertApiKey) {
        statusBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*StockAlert.pro API:*\n✅ Connected (Webhook ID: ${installation.stockalertWebhookId})`,
          },
        });
        statusBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Your webhook is automatically configured and active',
            },
          ],
        } as KnownBlock);
      } else {
        statusBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*StockAlert.pro API:*\n❌ Not connected',
          },
        });
        statusBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Run `/stockalert apikey <your-api-key>` to enable automatic webhook configuration',
            },
          ],
        } as KnownBlock);
      }

      return {
        response_type: 'ephemeral',
        blocks: statusBlocks,
      };
    }

    case 'apikey': {
      if (args.length < 2) {
        return {
          response_type: 'ephemeral',
          text:
            '❌ Please provide your StockAlert.pro API key\n\nExample: `/stockalert apikey sk_your_api_key_here`\n\n' +
            'You can generate an API key at https://stockalert.pro/dashboard/settings',
        };
      }

      const apiKey = args[1];
      if (!apiKey) {
        return {
          response_type: 'ephemeral',
          text:
            '❌ Please provide your StockAlert.pro API key\n\nExample: `/stockalert apikey sk_your_api_key_here`\n\n' +
            'You can generate an API key at https://stockalert.pro/dashboard/settings',
        };
      }

      // Validate API key format
      if (!apiKey.startsWith('sk_')) {
        return {
          response_type: 'ephemeral',
          text: '❌ Invalid API key format. StockAlert.pro API keys start with `sk_`',
        };
      }

      try {
        // Import at runtime to avoid circular dependency
        const { StockAlertAPI } = await import('../stockalert-api');
        const { getWebhookUrl } = await import('../constants');

        // Test the API key by creating/updating the webhook
        const api = new StockAlertAPI(apiKey);
        const webhookUrl = getWebhookUrl(command.team_id);

        // Check if webhook already exists
        let webhook = await api.findWebhookByUrl(webhookUrl);

        if (!webhook) {
          // Create new webhook
          webhook = await api.createWebhook({
            name: `Slack - ${command.team_domain}`,
            url: webhookUrl,
            events: ['alert.triggered'],
            is_active: true,
          });
        }

        // Save API key and webhook info to database
        await installationRepo.update(command.team_id, {
          stockalertApiKey: apiKey,
          stockalertWebhookId: webhook.id,
          stockalertWebhookSecret: webhook.secret,
        });

        return {
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '✅ *StockAlert.pro Integration Complete!*',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Webhook has been automatically configured:\n• Webhook ID: \`${webhook.id}\`\n• Events: Alert notifications\n• Status: Active`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Your alerts will now appear in this Slack workspace automatically.',
                },
              ],
            },
          ],
        };
      } catch (error: any) {
        console.error('Failed to configure StockAlert webhook:', error);

        return {
          response_type: 'ephemeral',
          text: `❌ Failed to configure webhook: ${error.message}\n\nPlease check your API key and try again.`,
        };
      }
    }

    case 'disconnect': {
      try {
        const installation = await installationRepo.findByTeamId(command.team_id);

        if (!installation?.stockalertApiKey) {
          return {
            response_type: 'ephemeral',
            text: '❌ No StockAlert.pro connection found to disconnect.',
          };
        }

        // Clear API connection data
        await installationRepo.update(command.team_id, {
          stockalertApiKey: null,
          stockalertWebhookId: null,
          stockalertWebhookSecret: null,
        });

        return {
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '✅ *StockAlert.pro disconnected successfully*\n\nYour API key and webhook configuration have been removed.',
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Run `/stockalert apikey <your-api-key>` to reconnect.',
                },
              ],
            },
          ],
        };
      } catch (error) {
        console.error('Failed to disconnect StockAlert:', error);
        return {
          response_type: 'ephemeral',
          text: '❌ Failed to disconnect. Please try again.',
        };
      }
    }

    case 'channel': {
      if (args.length < 2) {
        return {
          response_type: 'ephemeral',
          text: 'Please specify a channel. Example: `/stockalert channel #alerts`',
        };
      }

      const channelArg = args[1];
      if (!channelArg) {
        return {
          response_type: 'ephemeral',
          text: 'Please specify a channel. Example: `/stockalert channel #alerts`',
        };
      }

      // Extract channel ID from <#C1234567|channel-name> format or #channel-name
      const channelMatch = channelArg.match(/<#([^|>]+)(?:\|[^>]+)?>/);
      const channelId = channelMatch ? channelMatch[1] : command.channel_id;
      const channelName =
        channelArg.replace(/[<>#]/g, '').split('|')[1] || channelArg.replace(/[<>#]/g, '');

      // Store channel preference in database
      await channelRepo.create({
        teamId: command.team_id,
        channelId: channelId ?? command.channel_id,
        channelName: channelName,
        isDefault: true,
      });

      // Set as default channel
      await channelRepo.setDefaultChannel(command.team_id, channelId ?? command.channel_id);

      return {
        response_type: 'ephemeral',
        text: `✅ Default notification channel set to <#${channelId ?? command.channel_id}>`,
      };
    }

    default:
      return {
        response_type: 'ephemeral',
        text: `Unknown command: ${subcommand}. Use \`/stockalert help\` for available commands.`,
      };
  }
}
