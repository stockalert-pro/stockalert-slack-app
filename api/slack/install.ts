import { VercelRequest, VercelResponse } from '@vercel/node';
import { oauthStateRepo } from '../../lib/db/repositories/index';
import { getOAuthRedirectUrl } from '../../lib/constants';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Validate HTTP method
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Implement rate limiting for OAuth attempts (e.g., 5 attempts per 15 minutes per IP)

  // Validate environment variables
  const SLACK_CLIENT_ID = process.env['SLACK_CLIENT_ID'];
  if (!SLACK_CLIENT_ID) {
    console.error('Missing SLACK_CLIENT_ID environment variable');
    return res.status(500).json({ error: 'Service configuration error' });
  }

  const SLACK_REDIRECT_URI = process.env['SLACK_REDIRECT_URI'] || getOAuthRedirectUrl();

  try {
    // Generate and store state for verification
    const state = await oauthStateRepo.create({
      source: 'web',
      timestamp: new Date().toISOString(),
    });

    // Validate state was created successfully
    if (!state) {
      throw new Error('Failed to generate OAuth state');
    }

    // Redirect to Slack OAuth with required scopes
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: 'chat:write,chat:write.public,commands,channels:read,im:write',
      redirect_uri: SLACK_REDIRECT_URI,
      state: state,
    });

    const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

    // Set comprehensive security headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    return res.redirect(302, authUrl);
  } catch (error) {
    // Log error details for debugging but don't expose to client
    console.error('OAuth flow initialization error:', error);

    // Return generic error message to client
    return res.status(500).json({
      error: 'Unable to start installation process',
      message: 'Please try again later or contact support if the issue persists',
    });
  }
}
