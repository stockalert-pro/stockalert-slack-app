import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSlashCommand, type SlashCommand } from '../../lib/handlers/commands';
import { channelRepo, installationRepo } from '../../lib/db/repositories';
import { getWebhookUrl } from '../../lib/constants';
import { StockAlertAPI } from '../../lib/stockalert-api';

// Mock dependencies
vi.mock('../../lib/db/repositories', () => ({
  channelRepo: {
    create: vi.fn(),
    findDefaultChannel: vi.fn(),
    setDefaultChannel: vi.fn(),
  },
  installationRepo: {
    findByTeamId: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../lib/constants', () => ({
  getWebhookUrl: vi.fn(),
}));

vi.mock('../../lib/stockalert-api', () => ({
  StockAlertAPI: vi.fn(),
}));

vi.mock('../../lib/onboarding', () => ({
  getOnboardingStatus: vi.fn(),
  getOnboardingProgressMessage: vi.fn(),
}));

describe('handleSlashCommand', () => {
  const baseCommand: SlashCommand = {
    token: 'test-token',
    team_id: 'T123456',
    team_domain: 'test-team',
    channel_id: 'C123456',
    channel_name: 'general',
    user_id: 'U123456',
    user_name: 'testuser',
    command: '/stockalert',
    text: '',
    response_url: 'https://hooks.slack.com/response',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getWebhookUrl as any).mockReturnValue('https://example.com/webhooks/T123456/stockalert');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('help command', () => {
    it('should show onboarding progress when not fully set up', async () => {
      const { getOnboardingStatus, getOnboardingProgressMessage } = await import(
        '../../lib/onboarding'
      );
      (getOnboardingStatus as any).mockResolvedValue({
        hasApiKey: false,
        hasDefaultChannel: true,
        hasWebhook: false,
      });
      (getOnboardingProgressMessage as any).mockReturnValue({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Setup progress...' },
          },
        ],
      });

      const command = { ...baseCommand, text: 'help' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.blocks).toHaveLength(4); // Header, progress, divider, commands
      expect(response.blocks?.[0]).toMatchObject({
        type: 'header',
        text: { type: 'plain_text', text: 'StockAlert.pro Setup' },
      });
    });

    it('should show regular help when fully set up', async () => {
      const { getOnboardingStatus } = await import('../../lib/onboarding');
      (getOnboardingStatus as any).mockResolvedValue({
        hasApiKey: true,
        hasDefaultChannel: true,
        hasWebhook: true,
      });

      const command = { ...baseCommand, text: 'help' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.blocks).toHaveLength(3);
      expect(response.blocks?.[0]).toMatchObject({
        type: 'section',
        text: { type: 'mrkdwn', text: '*StockAlert.pro Slack Commands*' },
      });
    });

    it('should show help as default command', async () => {
      const { getOnboardingStatus } = await import('../../lib/onboarding');
      (getOnboardingStatus as any).mockResolvedValue({
        hasApiKey: true,
        hasDefaultChannel: true,
        hasWebhook: true,
      });

      const command = { ...baseCommand, text: '' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.blocks?.[0]).toMatchObject({
        type: 'section',
        text: { type: 'mrkdwn', text: '*StockAlert.pro Slack Commands*' },
      });
    });
  });

  describe('test command', () => {
    it('should send test message to channel', async () => {
      const command = { ...baseCommand, text: 'test' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('in_channel');
      expect(response.blocks).toHaveLength(2);
      expect(response.blocks?.[0]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: expect.stringContaining('✅ *StockAlert.pro Test Message*'),
        },
      });
      expect(response.blocks?.[1]).toMatchObject({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: expect.stringContaining(`<@${command.user_id}>`),
          },
        ],
      });
    });
  });

  describe('status command', () => {
    it('should show complete status with API connected', async () => {
      const mockInstallation = {
        teamId: 'T123456',
        stockalertApiKey: 'sk_test_key',
        stockalertWebhookId: 'webhook_123',
      };
      const mockChannel = {
        channelId: 'C123456',
        channelName: 'alerts',
      };

      (installationRepo.findByTeamId as any).mockResolvedValue(mockInstallation);
      (channelRepo.findDefaultChannel as any).mockResolvedValue(mockChannel);

      const command = { ...baseCommand, text: 'status' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.blocks).toContainEqual(
        expect.objectContaining({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: expect.stringContaining('✅ Connected (Webhook ID: webhook_123)'),
          },
        })
      );
    });

    it('should show status without API connection', async () => {
      (installationRepo.findByTeamId as any).mockResolvedValue(null);
      (channelRepo.findDefaultChannel as any).mockResolvedValue(null);

      const command = { ...baseCommand, text: 'status' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.blocks).toContainEqual(
        expect.objectContaining({
          type: 'section',
          fields: expect.arrayContaining([
            expect.objectContaining({
              type: 'mrkdwn',
              text: expect.stringContaining('❌ Not installed'),
            }),
          ]),
        })
      );
      expect(response.blocks).toContainEqual(
        expect.objectContaining({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: expect.stringContaining('❌ Not connected'),
          },
        })
      );
    });
  });

  describe('apikey command', () => {
    it('should reject missing API key', async () => {
      const command = { ...baseCommand, text: 'apikey' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Please provide your StockAlert.pro API key');
    });

    it('should reject invalid API key format', async () => {
      const command = { ...baseCommand, text: 'apikey invalid_key' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Invalid API key format');
    });

    it('should successfully configure webhook with valid API key', async () => {
      const mockWebhook = {
        id: 'webhook_123',
        secret: 'webhook_secret',
        url: 'https://example.com/webhooks/T123456/stockalert',
      };

      const mockApi = {
        findWebhookByUrl: vi.fn().mockResolvedValue(null),
        createWebhook: vi.fn().mockResolvedValue(mockWebhook),
      };

      (StockAlertAPI as any).mockImplementation(() => mockApi);
      (installationRepo.update as any).mockResolvedValue(true);

      const command = { ...baseCommand, text: 'apikey sk_test_key' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.blocks?.[0]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *StockAlert.pro Integration Complete!*',
        },
      });

      expect(mockApi.createWebhook).toHaveBeenCalledWith({
        name: 'Slack - test-team',
        url: 'https://example.com/webhooks/T123456/stockalert',
        events: ['alert.triggered'],
        is_active: true,
      });

      expect(installationRepo.update).toHaveBeenCalledWith('T123456', {
        stockalertApiKey: 'sk_test_key',
        stockalertWebhookId: 'webhook_123',
        stockalertWebhookSecret: 'webhook_secret',
      });
    });

    it('should handle existing webhook', async () => {
      const mockWebhook = {
        id: 'webhook_existing',
        secret: 'webhook_secret',
        url: 'https://example.com/webhooks/T123456/stockalert',
      };

      const mockApi = {
        findWebhookByUrl: vi.fn().mockResolvedValue(mockWebhook),
        createWebhook: vi.fn(),
      };

      (StockAlertAPI as any).mockImplementation(() => mockApi);
      (installationRepo.update as any).mockResolvedValue(true);

      const command = { ...baseCommand, text: 'apikey sk_test_key' };
      const response = await handleSlashCommand(command);

      expect(mockApi.createWebhook).not.toHaveBeenCalled();
      expect(response.blocks?.[0]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *StockAlert.pro Integration Complete!*',
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockApi = {
        findWebhookByUrl: vi.fn().mockRejectedValue(new Error('API Error')),
      };

      (StockAlertAPI as any).mockImplementation(() => mockApi);

      const command = { ...baseCommand, text: 'apikey sk_test_key' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Failed to configure webhook: API Error');
    });
  });

  describe('channel command', () => {
    it('should reject missing channel argument', async () => {
      const command = { ...baseCommand, text: 'channel' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Please specify a channel');
    });

    it('should set channel from mention format', async () => {
      (channelRepo.create as any).mockResolvedValue(true);
      (channelRepo.setDefaultChannel as any).mockResolvedValue(true);

      const command = { ...baseCommand, text: 'channel <#C789012|alerts>' };
      const response = await handleSlashCommand(command);

      expect(channelRepo.create).toHaveBeenCalledWith({
        teamId: 'T123456',
        channelId: 'C789012',
        channelName: 'alerts',
        isDefault: true,
      });

      expect(channelRepo.setDefaultChannel).toHaveBeenCalledWith('T123456', 'C789012');

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toBe('✅ Default notification channel set to <#C789012>');
    });

    it('should set channel from plain format', async () => {
      (channelRepo.create as any).mockResolvedValue(true);
      (channelRepo.setDefaultChannel as any).mockResolvedValue(true);

      const command = { ...baseCommand, text: 'channel #alerts' };
      const response = await handleSlashCommand(command);

      expect(channelRepo.create).toHaveBeenCalledWith({
        teamId: 'T123456',
        channelId: 'C123456', // Falls back to current channel
        channelName: 'alerts',
        isDefault: true,
      });

      expect(response.text).toBe('✅ Default notification channel set to <#C123456>');
    });

    it('should handle channel without # prefix', async () => {
      (channelRepo.create as any).mockResolvedValue(true);
      (channelRepo.setDefaultChannel as any).mockResolvedValue(true);

      const command = { ...baseCommand, text: 'channel alerts' };
      await handleSlashCommand(command);

      expect(channelRepo.create).toHaveBeenCalledWith({
        teamId: 'T123456',
        channelId: 'C123456',
        channelName: 'alerts',
        isDefault: true,
      });
    });
  });

  describe('unknown command', () => {
    it('should show error for unknown subcommand', async () => {
      const command = { ...baseCommand, text: 'unknown' };
      const response = await handleSlashCommand(command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toBe(
        'Unknown command: unknown. Use `/stockalert help` for available commands.'
      );
    });
  });
});
