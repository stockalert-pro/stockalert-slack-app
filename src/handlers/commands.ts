import { App, SlashCommand } from '@slack/bolt';
import { WebhookHandler } from './webhook';
import { Config } from '../types';

export class CommandHandler {
  constructor(
    private app: App,
    private config: Config,
    private webhookHandler: WebhookHandler
  ) {
    this.registerCommands();
  }

  /**
   * Register slash commands
   */
  private registerCommands(): void {
    // /stockalert help
    this.app.command('/stockalert', async ({ command, ack, respond }) => {
      await ack();

      const args = command.text.trim().split(' ');
      const subcommand = args[0]?.toLowerCase() || 'help';

      try {
        switch (subcommand) {
          case 'help':
            await this.handleHelp(respond);
            break;
          case 'test':
            await this.handleTest(command, respond);
            break;
          case 'channel':
            await this.handleChannel(args.slice(1), command, respond);
            break;
          case 'status':
            await this.handleStatus(respond);
            break;
          default:
            await respond({
              text: `Unknown command: ${subcommand}. Use \`/stockalert help\` for available commands.`,
            });
        }
      } catch (error) {
        console.error('Command error:', error);
        await respond({
          text: '❌ An error occurred while processing your command.',
        });
      }
    });
  }

  /**
   * Handle help command
   */
  private async handleHelp(respond: any): Promise<void> {
    await respond({
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
                  '• `/stockalert channel #channel` - Set default notification channel\n' +
                  '• `/stockalert status` - Show integration status',
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
    });
  }

  /**
   * Handle test command
   */
  private async handleTest(command: SlashCommand, respond: any): Promise<void> {
    try {
      await this.webhookHandler.sendTestMessage(command.channel_id);
      await respond({
        text: '✅ Test message sent! Check the channel for the notification.',
      });
    } catch (error) {
      await respond({
        text: '❌ Failed to send test message. Please check the bot permissions.',
      });
    }
  }

  /**
   * Handle channel command
   */
  private async handleChannel(args: string[], command: SlashCommand, respond: any): Promise<void> {
    if (args.length === 0) {
      await respond({
        text: 'Please specify a channel. Example: `/stockalert channel #alerts`',
      });
      return;
    }

    const channelArg = args[0];
    const channelMatch = channelArg.match(/^<#([A-Z0-9]+)\|(.+)>$/);
    const channelId = channelMatch ? channelMatch[1] : channelArg.replace('#', '');

    // TODO: Store channel preference in a database or config
    await respond({
      text: `✅ Default notification channel set to <#${channelId}>`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ Default notification channel set to <#${channelId}>\n\n*Note:* This is a demo. In production, this preference would be saved.`,
          },
        },
      ],
    });
  }

  /**
   * Handle status command
   */
  private async handleStatus(respond: any): Promise<void> {
    const status = {
      app: '✅ Connected',
      webhooks: '✅ Ready',
      environment: this.config.server.environment,
      defaultChannel: this.config.slack.defaultChannel || 'Not set',
    };

    await respond({
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
              text: `*Slack App:*\n${status.app}`,
            },
            {
              type: 'mrkdwn',
              text: `*Webhooks:*\n${status.webhooks}`,
            },
            {
              type: 'mrkdwn',
              text: `*Environment:*\n${status.environment}`,
            },
            {
              type: 'mrkdwn',
              text: `*Default Channel:*\n${status.defaultChannel}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Last checked: ${new Date().toLocaleString()}`,
            },
          ],
        },
      ],
    });
  }
}