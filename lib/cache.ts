import { kv } from '@vercel/kv';
import { Monitor } from './monitoring';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache namespace for key grouping
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

// In-memory cache for fallback when KV is not available
class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  set<T>(key: string, value: T, ttl: number): void {
    const now = Date.now();
    this.cache.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttl * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Main cache class
export class Cache {
  private static instance: Cache;
  private inMemory: InMemoryCache;
  private monitor: Monitor;
  private defaultTTL = 300; // 5 minutes default

  private constructor() {
    this.inMemory = new InMemoryCache();
    this.monitor = Monitor.getInstance();
  }

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  // Build cache key with namespace
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  // Set value in cache
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const { ttl = this.defaultTTL, namespace } = options;
    const fullKey = this.buildKey(key, namespace);

    this.monitor.startTimer('cache.set');

    try {
      // Try KV first
      if (process.env.KV_URL) {
        await kv.set(fullKey, value, { ex: ttl });
      }

      // Always set in memory as well for faster access
      this.inMemory.set(fullKey, value, ttl);

      this.monitor.endTimer('cache.set', { status: 'success', namespace: namespace || 'default' });
      this.monitor.incrementCounter('cache.sets', 1, { namespace: namespace || 'default' });
    } catch (error) {
      console.error('Cache set error:', error);
      this.monitor.endTimer('cache.set', { status: 'error', namespace: namespace || 'default' });

      // Fallback to in-memory only
      this.inMemory.set(fullKey, value, ttl);
    }
  }

  // Get value from cache
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const fullKey = this.buildKey(key, namespace);

    this.monitor.startTimer('cache.get');

    try {
      // Check in-memory first
      const memValue = this.inMemory.get<T>(fullKey);
      if (memValue !== null) {
        this.monitor.endTimer('cache.get', {
          status: 'hit',
          source: 'memory',
          namespace: namespace || 'default',
        });
        this.monitor.incrementCounter('cache.hits', 1, {
          source: 'memory',
          namespace: namespace || 'default',
        });
        return memValue;
      }

      // Try KV if available
      if (process.env.KV_URL) {
        const kvValue = await kv.get<T>(fullKey);
        if (kvValue !== null) {
          // Store in memory for next access
          this.inMemory.set(fullKey, kvValue, this.defaultTTL);

          this.monitor.endTimer('cache.get', {
            status: 'hit',
            source: 'kv',
            namespace: namespace || 'default',
          });
          this.monitor.incrementCounter('cache.hits', 1, {
            source: 'kv',
            namespace: namespace || 'default',
          });
          return kvValue;
        }
      }

      this.monitor.endTimer('cache.get', { status: 'miss', namespace: namespace || 'default' });
      this.monitor.incrementCounter('cache.misses', 1, { namespace: namespace || 'default' });
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.monitor.endTimer('cache.get', { status: 'error', namespace: namespace || 'default' });
      return null;
    }
  }

  // Get or set pattern
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { namespace } = options;

    // Try to get from cache first
    const cached = await this.get<T>(key, namespace);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - compute value
    this.monitor.startTimer('cache.compute');
    try {
      const value = await factory();
      await this.set(key, value, options);

      this.monitor.endTimer('cache.compute', {
        status: 'success',
        namespace: namespace || 'default',
      });
      return value;
    } catch (error) {
      this.monitor.endTimer('cache.compute', {
        status: 'error',
        namespace: namespace || 'default',
      });
      throw error;
    }
  }

  // Delete from cache
  async delete(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);

    try {
      // Delete from both stores
      this.inMemory.delete(fullKey);

      if (process.env.KV_URL) {
        await kv.del(fullKey);
      }

      this.monitor.incrementCounter('cache.deletes', 1, { namespace: namespace || 'default' });
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Clear cache by namespace
  async clearNamespace(namespace: string): Promise<void> {
    this.monitor.startTimer('cache.clear');

    try {
      // Clear from in-memory
      this.inMemory.clear(); // This clears all, but it's a simple implementation

      // Clear from KV if available
      if (process.env.KV_URL) {
        const keys = await kv.keys(`${namespace}:*`);
        if (keys.length > 0) {
          await kv.del(...keys);
        }
      }

      this.monitor.endTimer('cache.clear', { status: 'success', namespace });
      this.monitor.incrementCounter('cache.clears', 1, { namespace });
    } catch (error) {
      console.error('Cache clear error:', error);
      this.monitor.endTimer('cache.clear', { status: 'error', namespace });
    }
  }

  // Warm up cache with frequently accessed data
  async warmup(items: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    this.monitor.startTimer('cache.warmup');

    try {
      await Promise.all(items.map(({ key, value, options }) => this.set(key, value, options)));

      this.monitor.endTimer('cache.warmup', {
        status: 'success',
        count: items.length.toString(),
      });
    } catch (error) {
      console.error('Cache warmup error:', error);
      this.monitor.endTimer('cache.warmup', { status: 'error' });
    }
  }

  // Get cache statistics
  async getStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {
      inMemorySize: this.inMemory['cache'].size,
      kvAvailable: Boolean(process.env.KV_URL),
    };

    if (process.env.KV_URL) {
      try {
        const keys = await kv.keys('*');
        stats.kvSize = keys.length;
      } catch (error) {
        console.error('Failed to get KV stats:', error);
      }
    }

    return stats;
  }
}

// Cache decorators
export function cached(options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = Cache.getInstance();

      // Create cache key from method name and arguments
      const cacheKey = `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;

      return cache.getOrSet(cacheKey, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

// Specialized caches for different use cases
export class ChannelCache {
  private cache: Cache;
  private namespace = 'channels';

  constructor() {
    this.cache = Cache.getInstance();
  }

  async getChannel(teamId: string, channelId: string): Promise<any | null> {
    const key = `${teamId}:${channelId}`;
    return this.cache.get(key, this.namespace);
  }

  async setChannel(teamId: string, channelId: string, data: any): Promise<void> {
    const key = `${teamId}:${channelId}`;
    await this.cache.set(key, data, {
      namespace: this.namespace,
      ttl: 3600, // 1 hour
    });
  }

  async clearTeam(_teamId: string): Promise<void> {
    // This would require pattern-based deletion which is not implemented
    // For now, we'll clear the entire namespace
    await this.cache.clearNamespace(this.namespace);
  }
}

export class InstallationCache {
  private cache: Cache;
  private namespace = 'installations';

  constructor() {
    this.cache = Cache.getInstance();
  }

  async getInstallation(teamId: string): Promise<any | null> {
    return this.cache.get(teamId, this.namespace);
  }

  async setInstallation(teamId: string, installation: any): Promise<void> {
    await this.cache.set(teamId, installation, {
      namespace: this.namespace,
      ttl: 86400, // 24 hours
    });
  }

  async deleteInstallation(teamId: string): Promise<void> {
    await this.cache.delete(teamId, this.namespace);
  }
}

// Export specialized cache instances
export const channelCache = new ChannelCache();
export const installationCache = new InstallationCache();
