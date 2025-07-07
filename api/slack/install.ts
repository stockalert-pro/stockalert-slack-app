import { VercelRequest, VercelResponse } from '@vercel/node';
import { oauthStateRepo } from '../../lib/db/repositories';
import { getOAuthRedirectUrl } from '../../lib/constants';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || getOAuthRedirectUrl();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Generate and store state for verification
    const state = await oauthStateRepo.create({
      source: 'web',
      timestamp: new Date().toISOString(),
    });
    
    // Redirect to Slack OAuth
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: 'chat:write,chat:write.public,commands,channels:read,groups:read',
      redirect_uri: SLACK_REDIRECT_URI,
      state: state,
    });

    res.redirect(302, `https://slack.com/oauth/v2/authorize?${params}`);
  } catch (error) {
    console.error('Error generating OAuth state:', error);
    res.status(500).send('Failed to initiate OAuth flow');
  }
}