import { VercelRequest, VercelResponse } from '@vercel/node';
import { WebClient } from '@slack/web-api';
import { installationRepo, oauthStateRepo } from '../../lib/db/repositories';
import { requireEnv } from '../../lib/env-validator';
import { getOAuthRedirectUrl } from '../../lib/constants';

const SLACK_CLIENT_ID = requireEnv('SLACK_CLIENT_ID');
const SLACK_CLIENT_SECRET = requireEnv('SLACK_CLIENT_SECRET');
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || getOAuthRedirectUrl();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, '/slack-error?error=' + error);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  if (!state || typeof state !== 'string') {
    return res.status(400).send('Missing state parameter');
  }

  try {
    // Verify state parameter
    const oauthState = await oauthStateRepo.verify(state);
    if (!oauthState) {
      return res.status(400).send('Invalid or expired state parameter');
    }

    // Exchange code for access token
    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code: code,
      redirect_uri: SLACK_REDIRECT_URI,
    });

    if (!result.ok || !result.access_token || !result.team?.id) {
      throw new Error('OAuth response missing required fields');
    }

    // Store installation data in database
    await installationRepo.create({
      teamId: result.team.id,
      teamName: result.team.name,
      botToken: result.access_token,
      botId: result.bot_user_id || '',
      botUserId: result.bot_user_id || '',
      appId: result.app_id || '',
      enterpriseId: result.enterprise?.id,
      enterpriseName: result.enterprise?.name,
      installerUserId: result.authed_user?.id,
      scope: result.scope,
      tokenType: result.token_type || 'bot',
    });

    console.log('Installation successful for team:', result.team.id);

    // Start onboarding process
    try {
      const { sendWelcomeMessage } = await import('../../lib/onboarding');
      
      const botClient = new WebClient(result.access_token);
      await sendWelcomeMessage(
        botClient,
        result.team.id,
        result.authed_user?.id || ''
      );
    } catch (error) {
      console.error('Failed to send welcome message:', error);
    }

    // Redirect to success page
    res.redirect(302, '/slack-success');
  } catch (error) {
    console.error('OAuth error:', error);
    res.redirect(302, '/slack-error');
  }
}