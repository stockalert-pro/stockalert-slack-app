import { WebClient } from '@slack/web-api';
import { Block, KnownBlock } from '@slack/web-api';
import { installationRepo, channelRepo } from './db/repositories';

interface SlackMessage {
  channel: string;
  text: string;
  blocks?: (KnownBlock | Block)[];
  teamId?: string;
}

const getSlackToken = async (teamId?: string): Promise<string> => {
  // If no teamId provided, fall back to environment variable (for development)
  if (!teamId) {
    return process.env.SLACK_BOT_TOKEN || '';
  }

  const installation = await installationRepo.findByTeamId(teamId);
  if (!installation) {
    throw new Error(`No installation found for team ${teamId}`);
  }

  return installation.botToken;
};

const getDefaultChannel = async (teamId: string): Promise<string | null> => {
  const channel = await channelRepo.findDefaultChannel(teamId);
  return channel?.channelId || null;
};

export async function postToSlack(message: SlackMessage): Promise<void> {
  try {
    const token = await getSlackToken(message.teamId);
    const client = new WebClient(token);

    // If no channel specified and teamId provided, try to use default channel
    let channel = message.channel;
    if (!channel && message.teamId) {
      const defaultChannel = await getDefaultChannel(message.teamId);
      if (defaultChannel) {
        channel = defaultChannel;
      } else {
        throw new Error('No channel specified and no default channel configured');
      }
    }

    await client.chat.postMessage({
      channel,
      text: message.text,
      blocks: message.blocks,
      unfurl_links: false,
      unfurl_media: false,
    });
  } catch (error) {
    console.error('Error posting to Slack:', error);
    throw error;
  }
}

export async function getSlackClient(teamId?: string): Promise<WebClient> {
  const token = await getSlackToken(teamId);
  return new WebClient(token);
}