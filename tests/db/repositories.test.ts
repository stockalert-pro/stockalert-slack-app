import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstallationRepository } from '../../lib/db/repositories/installations';
import { ChannelRepository } from '../../lib/db/repositories/channels';
import { WebhookEventRepository } from '../../lib/db/repositories/webhook-events';
import { OAuthStateRepository } from '../../lib/db/repositories/oauth-states';
import { db } from '../../lib/db';
import { installations, channels, webhookEvents, oauthStates } from '../../lib/db/schema';

// Mock the database module
vi.mock('../../lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Database Repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('InstallationRepository', () => {
    const repo = new InstallationRepository();

    const mockInstallation = {
      id: 1,
      teamId: 'T123456',
      teamName: 'Test Team',
      enterpriseId: null,
      enterpriseName: null,
      botToken: 'xoxb-test-token',
      botId: 'B123456',
      botUserId: 'U123456',
      appId: 'A123456',
      installerUserId: 'U789012',
      scope: 'chat:write,commands',
      tokenType: 'bot',
      stockalertApiKey: null,
      stockalertWebhookId: null,
      stockalertWebhookSecret: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('create', () => {
      it('should create a new installation', async () => {
        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          onConflictDoUpdate: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockInstallation]),
        };
        (db.insert as any).mockReturnValue(mockDb);

        const result = await repo.create({
          teamId: 'T123456',
          teamName: 'Test Team',
          botToken: 'xoxb-test-token',
          botId: 'B123456',
          botUserId: 'U123456',
          appId: 'A123456',
          installerUserId: 'U789012',
          scope: 'chat:write,commands',
          tokenType: 'bot',
        });

        expect(db.insert).toHaveBeenCalledWith(installations);
        expect(result).toEqual(mockInstallation);
      });

      it('should throw error if creation fails', async () => {
        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          onConflictDoUpdate: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        };
        (db.insert as any).mockReturnValue(mockDb);

        await expect(
          repo.create({
            teamId: 'T123456',
            teamName: 'Test Team',
            botToken: 'xoxb-test-token',
            botId: 'B123456',
            botUserId: 'U123456',
            appId: 'A123456',
            installerUserId: 'U789012',
            scope: 'chat:write,commands',
            tokenType: 'bot',
          })
        ).rejects.toThrow('Failed to create installation');
      });
    });

    describe('findByTeamId', () => {
      it('should find installation by team ID', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockInstallation]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findByTeamId('T123456');

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual(mockInstallation);
      });

      it('should find installation by team ID and enterprise ID', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockInstallation]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findByTeamId('T123456', 'E123456');

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual(mockInstallation);
      });

      it('should return null if not found', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findByTeamId('T999999');

        expect(result).toBeNull();
      });
    });

    describe('update', () => {
      it('should update installation', async () => {
        const mockDb = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockInstallation]),
        };
        (db.update as any).mockReturnValue(mockDb);

        const result = await repo.update('T123456', {
          stockalertApiKey: 'sk_test_key',
        });

        expect(db.update).toHaveBeenCalledWith(installations);
        expect(result).toEqual(mockInstallation);
      });

      it('should return null if update finds no records', async () => {
        const mockDb = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        };
        (db.update as any).mockReturnValue(mockDb);

        const result = await repo.update('T999999', {
          stockalertApiKey: 'sk_test_key',
        });

        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete installation', async () => {
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const result = await repo.delete('T123456');

        expect(db.delete).toHaveBeenCalledWith(installations);
        expect(result).toBe(true);
      });

      it('should return false if no records deleted', async () => {
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({ rowCount: 0 }),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const result = await repo.delete('T999999');

        expect(result).toBe(false);
      });
    });

    describe('listAll', () => {
      it('should list all installations', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockResolvedValue([mockInstallation]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.listAll();

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual([mockInstallation]);
      });
    });
  });

  describe('ChannelRepository', () => {
    const repo = new ChannelRepository();

    const mockChannel = {
      id: 1,
      teamId: 'T123456',
      channelId: 'C123456',
      channelName: 'general',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('create', () => {
      it('should create a new channel', async () => {
        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          onConflictDoUpdate: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockChannel]),
        };
        (db.insert as any).mockReturnValue(mockDb);

        const result = await repo.create({
          teamId: 'T123456',
          channelId: 'C123456',
          channelName: 'general',
          isDefault: true,
        });

        expect(db.insert).toHaveBeenCalledWith(channels);
        expect(result).toEqual(mockChannel);
      });

      it('should throw error if creation fails', async () => {
        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          onConflictDoUpdate: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        };
        (db.insert as any).mockReturnValue(mockDb);

        await expect(
          repo.create({
            teamId: 'T123456',
            channelId: 'C123456',
            channelName: 'general',
            isDefault: true,
          })
        ).rejects.toThrow('Failed to create channel');
      });
    });

    describe('findByTeamId', () => {
      it('should find all channels for a team', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([mockChannel]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findByTeamId('T123456');

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual([mockChannel]);
      });
    });

    describe('findDefaultChannel', () => {
      it('should find default channel for a team', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockChannel]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findDefaultChannel('T123456');

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual(mockChannel);
      });

      it('should return null if no default channel', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findDefaultChannel('T999999');

        expect(result).toBeNull();
      });
    });

    describe('setDefaultChannel', () => {
      it('should set default channel', async () => {
        const mockDb = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockChannel]),
        };
        (db.update as any).mockReturnValue(mockDb);

        const result = await repo.setDefaultChannel('T123456', 'C123456');

        expect(db.update).toHaveBeenCalledTimes(2); // Unset all, then set new
        expect(result).toEqual(mockChannel);
      });
    });

    describe('delete', () => {
      it('should delete channel', async () => {
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const result = await repo.delete('T123456', 'C123456');

        expect(db.delete).toHaveBeenCalledWith(channels);
        expect(result).toBe(true);
      });
    });
  });

  describe('WebhookEventRepository', () => {
    const repo = new WebhookEventRepository();

    const mockEvent = {
      id: 1,
      eventId: 'evt_123',
      teamId: 'T123456',
      eventType: 'alert.triggered',
      payload: { test: true },
      processedAt: null,
      createdAt: new Date(),
    };

    describe('create', () => {
      it('should create a new webhook event', async () => {
        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockEvent]),
        };
        (db.insert as any).mockReturnValue(mockDb);

        const result = await repo.create({
          eventId: 'evt_123',
          teamId: 'T123456',
          eventType: 'alert.triggered',
          payload: { test: true },
        });

        expect(db.insert).toHaveBeenCalledWith(webhookEvents);
        expect(result).toEqual(mockEvent);
      });

      it('should return null for duplicate event ID', async () => {
        const error = new Error('Duplicate key violation');
        (error as any).code = '23505';

        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockRejectedValue(error),
        };
        (db.insert as any).mockReturnValue(mockDb);

        const result = await repo.create({
          eventId: 'evt_123',
          teamId: 'T123456',
          eventType: 'alert.triggered',
          payload: { test: true },
        });

        expect(result).toBeNull();
      });

      it('should throw other errors', async () => {
        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        };
        (db.insert as any).mockReturnValue(mockDb);

        await expect(
          repo.create({
            eventId: 'evt_123',
            teamId: 'T123456',
            eventType: 'alert.triggered',
            payload: { test: true },
          })
        ).rejects.toThrow('Database error');
      });
    });

    describe('markProcessed', () => {
      it('should mark event as processed', async () => {
        const processedEvent = { ...mockEvent, processedAt: new Date() };
        const mockDb = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([processedEvent]),
        };
        (db.update as any).mockReturnValue(mockDb);

        const result = await repo.markProcessed('evt_123');

        expect(db.update).toHaveBeenCalledWith(webhookEvents);
        expect(result).toEqual(processedEvent);
      });
    });

    describe('findByEventId', () => {
      it('should find event by ID', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockEvent]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findByEventId('evt_123');

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual(mockEvent);
      });
    });

    describe('findUnprocessed', () => {
      it('should find unprocessed events', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockEvent]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findUnprocessed(10);

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual([mockEvent]);
      });
    });

    describe('findByTeamId', () => {
      it('should find events by team ID', async () => {
        const mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockEvent]),
        };
        (db.select as any).mockReturnValue(mockDb);

        const result = await repo.findByTeamId('T123456', 20);

        expect(db.select).toHaveBeenCalled();
        expect(result).toEqual([mockEvent]);
      });
    });

    describe('cleanup', () => {
      it('should cleanup old processed events', async () => {
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({ rowCount: 5 }),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const olderThan = new Date('2024-01-01');
        const result = await repo.cleanup(olderThan);

        expect(db.delete).toHaveBeenCalledWith(webhookEvents);
        expect(result).toBe(5);
      });
    });
  });

  describe('OAuthStateRepository', () => {
    const repo = new OAuthStateRepository();

    const mockState = {
      id: 1,
      state: 'state_123',
      metadata: null,
      expiresAt: new Date(Date.now() + 600000), // 10 minutes
      createdAt: new Date(),
    };

    describe('create', () => {
      it('should create a new OAuth state', async () => {
        const mockDb = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        (db.insert as any).mockReturnValue(mockDb);

        const result = await repo.create({ redirectUrl: 'https://example.com/callback' });

        expect(db.insert).toHaveBeenCalledWith(oauthStates);
        expect(result).toMatch(/^[a-f0-9]{32}$/); // Returns hex string
      });
    });

    describe('verify', () => {
      it('should verify valid state', async () => {
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockState]),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const result = await repo.verify('state_123');

        expect(result).toEqual(mockState);
        expect(db.delete).toHaveBeenCalledWith(oauthStates);
      });

      it('should return null for expired state', async () => {
        const expiredState = { ...mockState, expiresAt: new Date(Date.now() - 1000) };
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([expiredState]),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const result = await repo.verify('state_123');

        expect(result).toBeNull();
      });

      it('should return null for non-existent state', async () => {
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const result = await repo.verify('non_existent');

        expect(result).toBeNull();
      });
    });

    describe('cleanupExpired', () => {
      it('should cleanup expired states', async () => {
        const mockDb = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({ rowCount: 3 }),
        };
        (db.delete as any).mockReturnValue(mockDb);

        const result = await repo.cleanupExpired();

        expect(db.delete).toHaveBeenCalledWith(oauthStates);
        expect(result).toBe(3);
      });
    });
  });
});
