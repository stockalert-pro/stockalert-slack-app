import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv, requireEnv, getEnv, hasRequiredEnvVars } from '../lib/env-validator';

describe('Environment Validators', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env to a copy of the original
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('should validate when all required environment variables are set', () => {
      process.env['SLACK_CLIENT_ID'] = 'test-client-id';
      process.env['SLACK_CLIENT_SECRET'] = 'test-client-secret';
      process.env['SLACK_SIGNING_SECRET'] = 'test-signing-secret';
      process.env['STOCKALERT_WEBHOOK_SECRET'] = 'webhook-secret';
      process.env['POSTGRES_URL'] = 'postgres://user:pass@localhost:5432/db';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should warn about optional variables', () => {
      process.env['SLACK_CLIENT_ID'] = 'test-client-id';
      process.env['SLACK_CLIENT_SECRET'] = 'test-client-secret';
      process.env['SLACK_SIGNING_SECRET'] = 'test-signing-secret';
      process.env['STOCKALERT_WEBHOOK_SECRET'] = 'webhook-secret';
      process.env['POSTGRES_URL'] = 'postgres://user:pass@localhost:5432/db';
      // Missing optional: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, KV_URL

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      validateEnv();

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('Optional environment variables not configured');

      warnSpy.mockRestore();
    });

    it('should throw error for missing required fields', () => {
      process.env['SLACK_CLIENT_ID'] = 'test-client-id';
      // Missing other required fields

      expect(() => validateEnv()).toThrow('Missing required environment variables');
    });
  });

  describe('requireEnv', () => {
    it('should return value when environment variable exists', () => {
      process.env['TEST_VAR'] = 'test-value';

      const result = requireEnv('TEST_VAR');

      expect(result).toBe('test-value');
    });

    it('should throw error when environment variable does not exist', () => {
      delete process.env['MISSING_VAR'];

      expect(() => requireEnv('MISSING_VAR')).toThrow(
        'Environment variable MISSING_VAR is not set'
      );
    });
  });

  describe('getEnv', () => {
    it('should get required environment variable', () => {
      process.env['SLACK_CLIENT_ID'] = 'test-client-id';

      const result = getEnv('SLACK_CLIENT_ID');

      expect(result).toBe('test-client-id');
    });

    it('should get optional environment variable', () => {
      process.env['SLACK_BOT_TOKEN'] = 'xoxb-test';

      const result = getEnv('SLACK_BOT_TOKEN');

      expect(result).toBe('xoxb-test');
    });

    it('should return undefined for missing optional variable', () => {
      delete process.env['SLACK_APP_TOKEN'];

      const result = getEnv('SLACK_APP_TOKEN');

      expect(result).toBeUndefined();
    });

    it('should throw error for missing required variable', () => {
      delete process.env['SLACK_SIGNING_SECRET'];

      expect(() => getEnv('SLACK_SIGNING_SECRET')).toThrow(
        'Required environment variable SLACK_SIGNING_SECRET is not set'
      );
    });
  });

  describe('hasRequiredEnvVars', () => {
    it('should return true when all required variables are set', () => {
      process.env['SLACK_CLIENT_ID'] = 'test-client-id';
      process.env['SLACK_CLIENT_SECRET'] = 'test-client-secret';
      process.env['SLACK_SIGNING_SECRET'] = 'test-signing-secret';
      process.env['STOCKALERT_WEBHOOK_SECRET'] = 'webhook-secret';
      process.env['POSTGRES_URL'] = 'postgres://user:pass@localhost:5432/db';

      const result = hasRequiredEnvVars();

      expect(result).toBe(true);
    });

    it('should return false when any required variable is missing', () => {
      process.env['SLACK_CLIENT_ID'] = 'test-client-id';
      process.env['SLACK_CLIENT_SECRET'] = 'test-client-secret';
      process.env['SLACK_SIGNING_SECRET'] = 'test-signing-secret';
      process.env['STOCKALERT_WEBHOOK_SECRET'] = 'webhook-secret';
      delete process.env['POSTGRES_URL'];

      const result = hasRequiredEnvVars();

      expect(result).toBe(false);
    });

    it('should return false when all variables are missing', () => {
      delete process.env['SLACK_CLIENT_ID'];
      delete process.env['SLACK_CLIENT_SECRET'];
      delete process.env['SLACK_SIGNING_SECRET'];
      delete process.env['STOCKALERT_WEBHOOK_SECRET'];
      delete process.env['POSTGRES_URL'];

      const result = hasRequiredEnvVars();

      expect(result).toBe(false);
    });
  });

  describe('Integration', () => {
    it('should work together for complete environment validation', () => {
      // Set up complete valid environment
      process.env['SLACK_CLIENT_ID'] = 'client-id';
      process.env['SLACK_CLIENT_SECRET'] = 'client-secret';
      process.env['SLACK_SIGNING_SECRET'] = 'secret';
      process.env['STOCKALERT_WEBHOOK_SECRET'] = 'webhook-secret';
      process.env['POSTGRES_URL'] = 'postgres://test';
      process.env['SLACK_BOT_TOKEN'] = 'xoxb-test';
      process.env['NODE_ENV'] = 'test';
      process.env['BASE_URL'] = 'https://test.com';

      // Should not throw
      expect(() => validateEnv()).not.toThrow();

      // Should have all required vars
      expect(hasRequiredEnvVars()).toBe(true);

      // Should be able to get specific vars
      expect(getEnv('SLACK_CLIENT_ID')).toBe('client-id');
      expect(getEnv('SLACK_BOT_TOKEN')).toBe('xoxb-test');
      expect(requireEnv('STOCKALERT_WEBHOOK_SECRET')).toBe('webhook-secret');
    });
  });
});
