import { VercelRequest, VercelResponse } from '@vercel/node';
import { WebClient } from '@slack/web-api';
import { installationRepo, oauthStateRepo } from '../../lib/db/repositories';
import { getOAuthRedirectUrl } from '../../lib/constants';
import type { SlackOAuthConfig } from '../../lib/types/oauth';

// OAuth configuration loaded inside handler to catch env errors properly

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Load OAuth configuration
  const oauthConfig: SlackOAuthConfig = {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || getOAuthRedirectUrl(),
    scopes: '', // Not used in this handler
  };

  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    console.error('Missing Slack OAuth credentials');
    return res.redirect(302, '/slack-error?error=missing_credentials');
  }

  const { code, state, error } = req.query;

  console.log('OAuth callback received:', {
    code: code ? 'present' : 'missing',
    state: state ? 'present' : 'missing',
    error: error ? 'present' : 'missing',
    redirect_uri: oauthConfig.redirectUri,
  });

  if (error) {
    // Properly encode error parameter to prevent injection
    const encodedError = encodeURIComponent(String(error));
    return res.redirect(302, `/slack-error?error=${encodedError}`);
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
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      code: code,
      redirect_uri: oauthConfig.redirectUri,
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
      await sendWelcomeMessage(botClient, result.team.id, result.authed_user?.id || '');
    } catch (error) {
      console.error('Failed to send welcome message:', error);
    }

    // Redirect to success page
    return res.redirect(302, '/slack-success');
  } catch (error: unknown) {
    // Log error securely without exposing sensitive details
    console.error('OAuth flow failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    // Determine error code without exposing internal details
    let errorCode = 'oauth_failed';
    if (error instanceof Error) {
      // Map known errors to safe error codes
      if (error.message.includes('invalid_code')) {
        errorCode = 'invalid_code';
      } else if (error.message.includes('expired')) {
        errorCode = 'expired_code';
      } else if (error.message.includes('invalid_client')) {
        errorCode = 'invalid_client';
      }
    }

    return res.redirect(302, `/slack-error?error=${errorCode}`);
  }
}
