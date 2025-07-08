/**
 * OAuth-related type definitions for Slack integration
 */

/**
 * Metadata stored with OAuth state for security and tracking
 */
export interface OAuthStateMetadata {
  source: 'web' | 'cli' | 'api';
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
}

/**
 * Slack OAuth scope definitions
 * These are the permissions required by the StockAlert Slack app
 */
export interface SlackOAuthScopes {
  readonly CHAT_WRITE: 'chat:write';
  readonly CHAT_WRITE_PUBLIC: 'chat:write.public';
  readonly COMMANDS: 'commands';
  readonly CHANNELS_READ: 'channels:read';
  readonly IM_WRITE: 'im:write';
}

export const SLACK_OAUTH_SCOPES: SlackOAuthScopes = {
  CHAT_WRITE: 'chat:write',
  CHAT_WRITE_PUBLIC: 'chat:write.public',
  COMMANDS: 'commands',
  CHANNELS_READ: 'channels:read',
  IM_WRITE: 'im:write',
} as const;

/** Type for individual OAuth scope values */
export type SlackOAuthScope = SlackOAuthScopes[keyof SlackOAuthScopes];

/** Comma-separated string of all OAuth scopes for Slack API */
export const SLACK_OAUTH_SCOPE_STRING = Object.values(SLACK_OAUTH_SCOPES).join(',');

/**
 * Configuration for Slack OAuth flow
 */
export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
}
