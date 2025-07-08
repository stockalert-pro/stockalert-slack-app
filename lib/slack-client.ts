import { WebClient, KnownBlock } from '@slack/web-api';
import { installationRepo, channelRepo } from './db/repositories';
import { Monitor, measureAsync } from './monitoring';
import { channelCache, installationCache } from './cache';

interface SlackMessage {
  channel: string;
  text: string;
  blocks?: KnownBlock[];
  teamId?: string;
}

const getSlackToken = async (teamId?: string): Promise<string> => {
  // If no teamId provided, fall back to environment variable (for development)
  if (!teamId) {
    return process.env['SLACK_BOT_TOKEN'] || '';
  }

  // Try cache first
  const cached = await installationCache.getInstallation(teamId);
  if (cached) {
    return cached.botToken;
  }

  const installation = await installationRepo.findByTeamId(teamId);
  if (!installation) {
    throw new Error(`No installation found for team ${teamId}`);
  }

  // Cache for future use
  await installationCache.setInstallation(teamId, installation);

  return installation.botToken;
};

const getDefaultChannel = async (teamId: string): Promise<string | null> => {
  // Try cache first
  const cached = await channelCache.getChannel(teamId, 'default');
  if (cached) {
    return cached.channelId;
  }

  const channel = await channelRepo.findDefaultChannel(teamId);

  if (channel) {
    // Cache for future use
    await channelCache.setChannel(teamId, 'default', channel);
  }

  return channel?.channelId || null;
};

export async function postToSlack(message: SlackMessage): Promise<void> {
  const monitor = Monitor.getInstance();
  const startTime = Date.now();

  try {
    // Get token with monitoring
    const token = await measureAsync('slack.getToken', () => getSlackToken(message.teamId), {
      team: message.teamId || 'unknown',
    });

    if (!token) {
      throw new Error('No Slack token available');
    }

    const client = new WebClient(token);

    // If no channel specified and teamId provided, try to use default channel
    let channel = message.channel;
    if (!channel && message.teamId) {
      const defaultChannel = await measureAsync(
        'slack.getDefaultChannel',
        () => getDefaultChannel(message.teamId!),
        { team: message.teamId || 'unknown' }
      );

      if (defaultChannel) {
        channel = defaultChannel;
      } else {
        throw new Error('No channel specified and no default channel configured');
      }
    }

    // Post message with monitoring
    await measureAsync(
      'slack.postMessage',
      () =>
        client.chat.postMessage({
          channel,
          text: message.text,
          blocks: message.blocks,
          unfurl_links: false,
          unfurl_media: false,
        }),
      { team: message.teamId || 'unknown', channel }
    );

    // Record success metrics
    const totalTime = Date.now() - startTime;
    monitor.recordHistogram('slack.postMessage.totalTime', totalTime, {
      team: message.teamId || 'unknown',
      status: 'success',
    });
    monitor.incrementCounter('slack.messages.sent', 1, {
      team: message.teamId || 'unknown',
      channel,
    });
  } catch (error) {
    // Record error metrics
    const totalTime = Date.now() - startTime;
    monitor.recordHistogram('slack.postMessage.totalTime', totalTime, {
      team: message.teamId || 'unknown',
      status: 'error',
    });
    monitor.incrementCounter('slack.messages.failed', 1, {
      team: message.teamId || 'unknown',
      error: error instanceof Error ? error.name : 'unknown',
    });

    console.error('Error posting to Slack:', error);
    throw error;
  }
}

export async function getSlackClient(teamId?: string): Promise<WebClient> {
  return measureAsync(
    'slack.getClient',
    async () => {
      const token = await getSlackToken(teamId);
      if (!token) {
        throw new Error(`No Slack token available${teamId ? ` for team ${teamId}` : ''}`);
      }
      return new WebClient(token);
    },
    { team: teamId || 'unknown' }
  );
}
