import { VercelRequest, VercelResponse } from '@vercel/node';
import { WebClient } from '@slack/web-api';
import { installationRepo, oauthStateRepo } from '../../lib/db/repositories';
import { getOAuthRedirectUrl } from '../../lib/constants';

// Initialize these inside the handler to catch env errors properly
let SLACK_CLIENT_ID: string;
let SLACK_CLIENT_SECRET: string;
let SLACK_REDIRECT_URI: string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Load environment variables
    SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
    SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
    SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || getOAuthRedirectUrl();
    
    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
      console.error('Missing Slack credentials:', {
        client_id: !!SLACK_CLIENT_ID,
        client_secret: !!SLACK_CLIENT_SECRET
      });
      return res.redirect(302, '/slack-error?error=missing_credentials');
    }
  } catch (envError: any) {
    console.error('Environment variable error:', envError);
    return res.redirect(302, '/slack-error?error=env_error');
  }

  const { code, state, error } = req.query;

  console.log('OAuth callback received:', { 
    code: code ? 'present' : 'missing', 
    state: state ? 'present' : 'missing', 
    error,
    client_id_length: SLACK_CLIENT_ID.length,
    redirect_uri: SLACK_REDIRECT_URI
  });

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
  } catch (error: any) {
    console.error('OAuth error:', error);
    console.error('OAuth error details:', {
      message: error.message,
      code: error.code,
      data: error.data,
      stack: error.stack
    });
    
    // Try to get a meaningful error message
    let errorCode = 'unknown';
    if (error.data?.error) {
      errorCode = error.data.error;
    } else if (error.code) {
      errorCode = error.code;
    } else if (error.message) {
      errorCode = encodeURIComponent(error.message.substring(0, 50));
    }
    
    res.redirect(302, `/slack-error?error=${errorCode}`);
  }
}