import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Cache, cached, ChannelCache, InstallationCache } from '../lib/cache';

// Mock @vercel/kv
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

describe('Cache', () => {
  let cache: Cache;

  beforeEach(() => {
    cache = Cache.getInstance();
    vi.clearAllMocks();
  });

  describe('In-memory caching', () => {
    it('should store and retrieve values', async () => {
      await cache.set('test-key', { value: 'test' }, { ttl: 60 });
      const result = await cache.get('test-key');

      expect(result).toEqual({ value: 'test' });
    });

    it('should respect namespaces', async () => {
      await cache.set('key', 'value1', { namespace: 'ns1' });
      await cache.set('key', 'value2', { namespace: 'ns2' });

      const result1 = await cache.get('key', 'ns1');
      const result2 = await cache.get('key', 'ns2');

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('missing-key');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      await cache.set('delete-key', 'value');
      await cache.delete('delete-key');

      const result = await cache.get('delete-key');
      expect(result).toBeNull();
    });
  });

  describe('getOrSet pattern', () => {
    it('should return cached value if exists', async () => {
      await cache.set('existing', 'cached-value');

      const factory = vi.fn().mockResolvedValue('new-value');
      const result = await cache.getOrSet('existing', factory);

      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should compute and cache if missing', async () => {
      const factory = vi.fn().mockResolvedValue('computed-value');
      const result = await cache.getOrSet('new-key', factory, { ttl: 60 });

      expect(result).toBe('computed-value');
      expect(factory).toHaveBeenCalledTimes(1);

      // Verify it was cached
      const cached = await cache.get('new-key');
      expect(cached).toBe('computed-value');
    });

    it('should propagate factory errors', async () => {
      const factory = vi.fn().mockRejectedValue(new Error('Factory error'));

      await expect(cache.getOrSet('error-key', factory)).rejects.toThrow('Factory error');
    });
  });

  describe('Cache statistics', () => {
    it('should return cache stats', async () => {
      await cache.set('stat1', 'value1');
      await cache.set('stat2', 'value2');

      const stats = await cache.getStats();

      expect(stats.inMemorySize).toBeGreaterThanOrEqual(2);
      expect(stats.kvAvailable).toBe(false); // No KV_URL in test
    });
  });
});

describe('@cached decorator', () => {
  class TestService {
    private callCount = 0;

    @cached({ ttl: 60 })
    async getData(id: string): Promise<string> {
      this.callCount++;
      return `data-${id}-${this.callCount}`;
    }

    @cached({ namespace: 'custom' })
    async getCustomData(): Promise<number> {
      return Math.random();
    }
  }

  it('should cache method results', async () => {
    const service = new TestService();

    const result1 = await service.getData('123');
    const result2 = await service.getData('123');
    const result3 = await service.getData('456');

    expect(result1).toBe(result2); // Same arguments = cached
    expect(result1).not.toBe(result3); // Different arguments = new call
  });

  it('should use namespace option', async () => {
    const service = new TestService();

    const result1 = await service.getCustomData();
    const result2 = await service.getCustomData();

    expect(result1).toBe(result2); // Should be cached
  });
});

describe('Specialized caches', () => {
  describe('ChannelCache', () => {
    it('should cache channel data', async () => {
      const channelCache = new ChannelCache();

      const channelData = { channelId: 'C123', name: 'general' };
      await channelCache.setChannel('T123', 'C123', channelData);

      const result = await channelCache.getChannel('T123', 'C123');
      expect(result).toEqual(channelData);
    });

    it('should return null for missing channels', async () => {
      const channelCache = new ChannelCache();

      const result = await channelCache.getChannel('T999', 'C999');
      expect(result).toBeNull();
    });
  });

  describe('InstallationCache', () => {
    it('should cache installation data', async () => {
      const installationCache = new InstallationCache();

      const installation = {
        teamId: 'T123',
        botToken: 'xoxb-123',
        teamName: 'Test Team',
      };
      await installationCache.setInstallation('T123', installation);

      const result = await installationCache.getInstallation('T123');
      expect(result).toEqual(installation);
    });

    it('should delete installations', async () => {
      const installationCache = new InstallationCache();

      await installationCache.setInstallation('T123', { teamId: 'T123' });
      await installationCache.deleteInstallation('T123');

      const result = await installationCache.getInstallation('T123');
      expect(result).toBeNull();
    });
  });
});
