// Application constants with proper typing
interface AppConfig {
  readonly BASE_URL: string;
  readonly ROUTES: {
    readonly INSTALL: string;
    readonly OAUTH_CALLBACK: string;
    readonly COMMANDS: string;
    readonly INTERACTIVITY: string;
    readonly WEBHOOK: (teamId: string) => string;
  };
  readonly FEATURES: {
    readonly RATE_LIMITING: boolean;
    readonly EVENT_SUBSCRIPTIONS: boolean;
    readonly INTERACTIVITY: boolean;
  };
  readonly LIMITS: {
    readonly WEBHOOK_RATE_PER_MINUTE: number;
    readonly COMMAND_RATE_PER_MINUTE: number;
    readonly OAUTH_ATTEMPTS_PER_15_MIN: number;
  };
}

// Get base URL with proper fallback for Vercel deployments
const getBaseUrl = (): string => {
  // In production, prefer BASE_URL over VERCEL_URL
  if (process.env['BASE_URL']) {
    return process.env['BASE_URL'];
  }

  // For Vercel preview deployments
  if (process.env['VERCEL_URL']) {
    return `https://${process.env['VERCEL_URL']}`;
  }

  // Local development fallback
  return 'http://localhost:3000';
};

export const APP_CONFIG: AppConfig = {
  // Base URL for the application
  BASE_URL: getBaseUrl(),

  // API Routes
  ROUTES: {
    INSTALL: '/api/slack/install',
    OAUTH_CALLBACK: '/api/slack/oauth',
    COMMANDS: '/api/slack/commands',
    INTERACTIVITY: '/api/slack/interactivity',
    WEBHOOK: (teamId: string) => `/api/webhooks/${teamId}/stockalert`,
  },

  // Feature flags
  FEATURES: {
    RATE_LIMITING: false,
    EVENT_SUBSCRIPTIONS: false,
    INTERACTIVITY: false,
  },

  // Rate limiting constants
  LIMITS: {
    WEBHOOK_RATE_PER_MINUTE: 100,
    COMMAND_RATE_PER_MINUTE: 30,
    OAUTH_ATTEMPTS_PER_15_MIN: 5,
  },
} as const;

// Validate teamId format
const validateTeamId = (teamId: string): void => {
  if (!teamId || typeof teamId !== 'string') {
    throw new Error('Team ID is required');
  }

  // Slack team IDs typically start with T and are alphanumeric
  if (!/^T[A-Z0-9]+$/.test(teamId)) {
    throw new Error('Invalid team ID format');
  }
};

// Helper to get full URLs with validation
export const getWebhookUrl = (teamId: string): string => {
  validateTeamId(teamId);
  return `${APP_CONFIG.BASE_URL}${APP_CONFIG.ROUTES.WEBHOOK(teamId)}`;
};

export const getOAuthRedirectUrl = (): string => {
  return `${APP_CONFIG.BASE_URL}${APP_CONFIG.ROUTES.OAUTH_CALLBACK}`;
};

// Additional URL helpers
export const getInstallUrl = (): string => {
  return `${APP_CONFIG.BASE_URL}${APP_CONFIG.ROUTES.INSTALL}`;
};

export const getInteractivityUrl = (): string => {
  return `${APP_CONFIG.BASE_URL}${APP_CONFIG.ROUTES.INTERACTIVITY}`;
};

// Environment checks
export const isProduction = (): boolean => {
  return process.env['NODE_ENV'] === 'production';
};

export const isVercelDeployment = (): boolean => {
  return Boolean(process.env['VERCEL']);
};
