// Rate limiting is optional - will be disabled if KV is not configured
let kv: any;
try {
  kv = require('@vercel/kv').kv;
} catch (e) {
  console.log('KV not available, rate limiting disabled');
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export class RateLimiter {
  private readonly prefix: string;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(options: {
    prefix: string;
    limit: number;
    windowMs: number;
  }) {
    this.prefix = options.prefix;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  async check(identifier: string): Promise<RateLimitResult> {
    // If KV is not available, allow all requests
    if (!kv) {
      return {
        success: true,
        limit: this.limit,
        remaining: this.limit,
        reset: Math.ceil((Date.now() + this.windowMs) / 1000),
      };
    }

    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // Remove old entries
      await kv.zremrangebyscore(key, -Infinity, windowStart);

      // Count requests in current window
      const count = await kv.zcard(key) as number;

      if (count >= this.limit) {
        // Get oldest entry to determine when limit resets
        const oldestEntries = await kv.zrange(key, 0, 0, { withScores: true }) as Array<{value: string, score: number}>;
        const reset = oldestEntries.length > 0 
          ? Math.ceil((oldestEntries[0].score + this.windowMs) / 1000)
          : Math.ceil((now + this.windowMs) / 1000);

        return {
          success: false,
          limit: this.limit,
          remaining: 0,
          reset,
        };
      }

      // Add current request
      await kv.zadd(key, { score: now, member: `${now}-${Math.random()}` });
      
      // Set expiry
      await kv.expire(key, Math.ceil(this.windowMs / 1000));

      return {
        success: true,
        limit: this.limit,
        remaining: this.limit - count - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    } catch (error) {
      // If KV is not available (development), allow all requests
      console.warn('Rate limiter error:', error);
      return {
        success: true,
        limit: this.limit,
        remaining: this.limit,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    }
  }
}

// Pre-configured rate limiters
export const webhookRateLimiter = new RateLimiter({
  prefix: 'webhook',
  limit: 100, // 100 requests
  windowMs: 60 * 1000, // per minute
});

export const oauthRateLimiter = new RateLimiter({
  prefix: 'oauth',
  limit: 5, // 5 attempts
  windowMs: 15 * 60 * 1000, // per 15 minutes
});

export const commandRateLimiter = new RateLimiter({
  prefix: 'command',
  limit: 30, // 30 commands
  windowMs: 60 * 1000, // per minute
});