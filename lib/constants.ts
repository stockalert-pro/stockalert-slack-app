// Application constants
export const APP_CONFIG = {
  // Base URL for the application - update this when domain changes
  BASE_URL: process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'https://stockalert-slack-app.vercel.app',
  
  // API Routes
  ROUTES: {
    INSTALL: '/api/slack/install',
    OAUTH_CALLBACK: '/api/slack/oauth',
    COMMANDS: '/api/slack/commands',
    WEBHOOK: (teamId: string) => `/api/webhooks/${teamId}/stockalert`,
  },
  
  // Feature flags
  FEATURES: {
    RATE_LIMITING: false,
    EVENT_SUBSCRIPTIONS: false,
    INTERACTIVITY: false,
  }
};

// Helper to get full URLs
export const getWebhookUrl = (teamId: string): string => {
  return `${APP_CONFIG.BASE_URL}${APP_CONFIG.ROUTES.WEBHOOK(teamId)}`;
};

export const getOAuthRedirectUrl = (): string => {
  return `${APP_CONFIG.BASE_URL}${APP_CONFIG.ROUTES.OAUTH_CALLBACK}`;
};