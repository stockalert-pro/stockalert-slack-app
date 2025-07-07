import { channelRepo, installationRepo } from '../db/repositories';
import { getWebhookUrl } from '../constants';

interface SlashCommand {
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
  const args = command.text.trim().split(' ');
  const subcommand = args[0]?.toLowerCase() || 'help';

  switch (subcommand) {
    case 'help':
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
              text: '• `/stockalert help` - Show this help message\n' +
                    '• `/stockalert test` - Send a test notification\n' +
                    '• `/stockalert status` - Show integration status\n' +
                    '• `/stockalert channel #channel` - Set notification channel',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Need help? Visit <https://stockalert.pro/api/docs|our documentation>',
              },
            ],
          },
        ],
      };

    case 'test':
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

    case 'status':
      const installation = await installationRepo.findByTeamId(command.team_id);
      const defaultChannel = await channelRepo.findDefaultChannel(command.team_id);
      const webhookUrl = getWebhookUrl(command.team_id);
      
      return {
        response_type: 'ephemeral',
        blocks: [
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
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Use this webhook URL in your StockAlert.pro account settings',
              },
            ],
          },
        ],
      };

    case 'channel':
      if (args.length < 2) {
        return {
          response_type: 'ephemeral',
          text: 'Please specify a channel. Example: `/stockalert channel #alerts`',
        };
      }
      
      const channelArg = args[1];
      // Extract channel ID from <#C1234567|channel-name> format or #channel-name
      const channelMatch = channelArg.match(/<#([^|>]+)|.*>/);
      const channelId = channelMatch ? channelMatch[1] : command.channel_id;
      const channelName = channelArg.replace(/[<>#]/g, '').split('|')[1] || channelArg.replace(/[<>#]/g, '');
      
      // Store channel preference in database
      await channelRepo.create({
        teamId: command.team_id,
        channelId: channelId,
        channelName: channelName,
        isDefault: 'true',
      });
      
      // Set as default channel
      await channelRepo.setDefaultChannel(command.team_id, channelId);
      
      return {
        response_type: 'ephemeral',
        text: `✅ Default notification channel set to <#${channelId}>`,
      };

    default:
      return {
        response_type: 'ephemeral',
        text: `Unknown command: ${subcommand}. Use \`/stockalert help\` for available commands.`,
      };
  }
}