import Redis from 'ioredis';

let redis: Redis | null = null;

/**
 * Initialize Redis connection
 * Returns null if Redis is not configured (graceful degradation)
 */
export function initRedis(): Redis | null {
  if (redis) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // Reconnect on READONLY error
        }
        return false;
      },
    });

    redis.on('error', () => {
      // Don't crash the app - graceful degradation
    });

    return redis;
  } catch {
    return null;
  }
}

/**
 * Get Redis client instance
 */
export function getRedis(): Redis | null {
  if (!redis) {
    return initRedis();
  }
  return redis;
}

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const cached = await client.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached(
  key: string,
  value: any,
  ttl: number = 3600
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.setex(key, ttl, JSON.stringify(value));
  } catch {
    // Don't throw - caching failures shouldn't break the app
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch {
    // Ignore cache deletion errors
  }
}

/**
 * Delete all keys matching a pattern
 * Use with caution - can be slow with many keys
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const keys: string[] = [];
    const stream = client.scanStream({
      match: pattern,
      count: 100,
    });

    stream.on('data', (resultKeys) => {
      keys.push(...resultKeys);
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', () => {
        if (keys.length > 0) {
          client.del(...keys).then(() => resolve()).catch(reject);
        } else {
          resolve();
        }
      });
      stream.on('error', reject);
    });
  } catch {
    // Ignore pattern invalidation errors
  }
}

/**
 * Get cache key helpers
 */
export const cacheKeys = {
  content: (tmdbId: number) => `content:${tmdbId}`,
  contentById: (contentId: string) => `content:id:${contentId}`,
  libraryStats: (userId: string) => `library:stats:${userId}`,
  libraryList: (userId: string, status?: string, type?: string) => {
    const parts = [`library:list:${userId}`];
    if (status && status !== 'all') parts.push(`status:${status}`);
    if (type && type !== 'all') parts.push(`type:${type}`);
    return parts.join(':');
  },
  libraryItem: (userId: string, libraryId: string) => `library:item:${userId}:${libraryId}`,
  libraryCheck: (userId: string, contentId: string) => `library:check:${userId}:${contentId}`,
  schedule: (userId: string, start?: string, end?: string) => {
    if (start && end) {
      return `schedule:${userId}:${start}:${end}`;
    }
    return `schedule:${userId}:all`;
  },
  scheduleDate: (userId: string, date: string) => `schedule:date:${userId}:${date}`,
  queue: (userId: string) => `queue:${userId}`,
};

/**
 * Get default TTL from environment or use provided default
 */
export function getCacheTTL(envKey: string, defaultValue: number): number {
  const ttl = process.env[envKey];
  return ttl ? parseInt(ttl, 10) : defaultValue;
}


