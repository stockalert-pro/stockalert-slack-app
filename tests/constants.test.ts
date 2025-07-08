import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getWebhookUrl,
  getOAuthRedirectUrl,
  getInstallUrl,
  getInteractivityUrl,
  isProduction,
  isVercelDeployment,
  APP_CONFIG,
} from '../lib/constants';

describe('Constants', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getWebhookUrl', () => {
    it('should generate webhook URL with team ID', () => {
      const url = getWebhookUrl('T123456');

      // URL will use whatever BASE_URL was set at module load time
      expect(url).toMatch(/\/api\/webhooks\/T123456\/stockalert$/);
    });

    it('should validate team ID format and accept valid IDs', () => {
      // Valid Slack team IDs
      expect(() => getWebhookUrl('T123456')).not.toThrow();
      expect(() => getWebhookUrl('TABC123DEF')).not.toThrow();
      expect(() => getWebhookUrl('T1')).not.toThrow();

      const url = getWebhookUrl('T123456');
      expect(url).toContain('/api/webhooks/T123456/stockalert');
    });

    it('should throw error for invalid team ID format', () => {
      expect(() => getWebhookUrl('invalid')).toThrow('Invalid team ID format');
      expect(() => getWebhookUrl('123456')).toThrow('Invalid team ID format');
      expect(() => getWebhookUrl('t123456')).toThrow('Invalid team ID format'); // lowercase t
      expect(() => getWebhookUrl('')).toThrow('Team ID is required');
    });
  });

  describe('getOAuthRedirectUrl', () => {
    it('should generate OAuth redirect URL', () => {
      const url = getOAuthRedirectUrl();

      expect(url).toMatch(/\/api\/slack\/oauth$/);
    });
  });

  describe('getInstallUrl', () => {
    it('should generate install URL', () => {
      const url = getInstallUrl();

      expect(url).toMatch(/\/api\/slack\/install$/);
    });
  });

  describe('getInteractivityUrl', () => {
    it('should generate interactivity URL', () => {
      const url = getInteractivityUrl();

      expect(url).toMatch(/\/api\/slack\/interactivity$/);
    });
  });

  describe('isProduction', () => {
    it('should return true when NODE_ENV is production', () => {
      process.env['NODE_ENV'] = 'production';

      expect(isProduction()).toBe(true);
    });

    it('should return false when NODE_ENV is not production', () => {
      process.env['NODE_ENV'] = 'development';
      expect(isProduction()).toBe(false);

      process.env['NODE_ENV'] = 'test';
      expect(isProduction()).toBe(false);

      delete process.env['NODE_ENV'];
      expect(isProduction()).toBe(false);
    });
  });

  describe('isVercelDeployment', () => {
    it('should return true when VERCEL env var is set', () => {
      process.env['VERCEL'] = '1';

      expect(isVercelDeployment()).toBe(true);
    });

    it('should return false when VERCEL env var is not set', () => {
      delete process.env['VERCEL'];

      expect(isVercelDeployment()).toBe(false);
    });
  });

  describe('APP_CONFIG', () => {
    it('should have required structure', () => {
      expect(APP_CONFIG).toHaveProperty('BASE_URL');
      expect(APP_CONFIG).toHaveProperty('ROUTES');
      expect(APP_CONFIG).toHaveProperty('FEATURES');
      expect(APP_CONFIG).toHaveProperty('LIMITS');
    });

    it('should have correct route paths', () => {
      expect(APP_CONFIG.ROUTES.INSTALL).toBe('/api/slack/install');
      expect(APP_CONFIG.ROUTES.OAUTH_CALLBACK).toBe('/api/slack/oauth');
      expect(APP_CONFIG.ROUTES.COMMANDS).toBe('/api/slack/commands');
      expect(APP_CONFIG.ROUTES.INTERACTIVITY).toBe('/api/slack/interactivity');
      expect(APP_CONFIG.ROUTES.WEBHOOK('T123')).toBe('/api/webhooks/T123/stockalert');
    });

    it('should have correct feature flags', () => {
      expect(APP_CONFIG.FEATURES.RATE_LIMITING).toBe(false);
      expect(APP_CONFIG.FEATURES.EVENT_SUBSCRIPTIONS).toBe(false);
      expect(APP_CONFIG.FEATURES.INTERACTIVITY).toBe(false);
    });

    it('should have correct rate limits', () => {
      expect(APP_CONFIG.LIMITS.WEBHOOK_RATE_PER_MINUTE).toBe(100);
      expect(APP_CONFIG.LIMITS.COMMAND_RATE_PER_MINUTE).toBe(30);
      expect(APP_CONFIG.LIMITS.OAUTH_ATTEMPTS_PER_15_MIN).toBe(5);
    });

    it('should maintain consistent values', () => {
      const firstAccess = APP_CONFIG.ROUTES.INSTALL;
      const secondAccess = APP_CONFIG.ROUTES.INSTALL;

      expect(firstAccess).toBe(secondAccess);
      expect(APP_CONFIG.ROUTES.INSTALL).toBe('/api/slack/install');
    });
  });
});
