const { getRedisClient, isRedisAvailable } = require('./redis');

/**
 * In-memory fallback cache Map when Redis is unavailable
 * Map<string, { value: any, expiresAt: number | null }>
 */
const memoryCache = new Map();

// Periodic sweep for expired memory cache entries
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryCache.entries()) {
    if (v.expiresAt && v.expiresAt <= now) {
      memoryCache.delete(k);
    }
  }
}, 60000).unref();

const CACHE_PREFIX = 'ano:cache:';

class CacheService {
  /**
   * Format key with standard ano:cache: prefix if not already present
   */
  formatKey(key) {
    if (!key) return '';
    return key.startsWith(CACHE_PREFIX) ? key : `${CACHE_PREFIX}${key}`;
  }

  /**
   * Retrieve a cached item (deserialized from JSON)
   */
  async get(key) {
    const fullKey = this.formatKey(key);
    
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const raw = await client.get(fullKey);
        if (raw === null || raw === undefined) return null;
        return JSON.parse(raw);
      } catch (err) {
        // Fall back to memory cache on error
      }
    }

    // In-memory fallback
    const entry = memoryCache.get(fullKey);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      memoryCache.delete(fullKey);
      return null;
    }
    return entry.value;
  }

  /**
   * Set a cached item with an optional TTL (in seconds)
   */
  async set(key, value, ttlSeconds = 300) {
    const fullKey = this.formatKey(key);
    const serialized = JSON.stringify(value);

    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        if (ttlSeconds && ttlSeconds > 0) {
          await client.set(fullKey, serialized, 'EX', ttlSeconds);
        } else {
          await client.set(fullKey, serialized);
        }
        return true;
      } catch (err) {
        // Fall back to memory cache
      }
    }

    // In-memory fallback
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    memoryCache.set(fullKey, { value, expiresAt });
    return true;
  }

  /**
   * Delete a key from cache
   */
  async del(key) {
    const fullKey = this.formatKey(key);

    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        await client.del(fullKey);
      } catch (err) {
        // Fall back to memory
      }
    }

    memoryCache.delete(fullKey);
    return true;
  }

  /**
   * Delete all keys matching a pattern (e.g. "feed:*")
   */
  async delPattern(pattern) {
    const fullPattern = this.formatKey(pattern);

    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const stream = client.scanStream({
          match: fullPattern,
          count: 100
        });

        stream.on('data', async (keys) => {
          if (keys.length) {
            const pipeline = client.pipeline();
            keys.forEach((k) => pipeline.del(k));
            await pipeline.exec();
          }
        });
      } catch (err) {
        // Fall back to memory
      }
    }

    // In-memory regex deletion
    const regexPattern = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
    for (const k of memoryCache.keys()) {
      if (regexPattern.test(k)) {
        memoryCache.delete(k);
      }
    }
    return true;
  }

  /**
   * Check if key exists in cache
   */
  async has(key) {
    const fullKey = this.formatKey(key);

    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const exists = await client.exists(fullKey);
        return exists === 1;
      } catch (err) {
        // Fall back to memory
      }
    }

    const entry = memoryCache.get(fullKey);
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      memoryCache.delete(fullKey);
      return false;
    }
    return true;
  }

  /**
   * Fetch & Cache pattern: returns cached data if available, otherwise executes fetcherFn and caches result.
   */
  async wrap(key, fetcherFn, ttlSeconds = 300) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const freshData = await fetcherFn();
    if (freshData !== null && freshData !== undefined) {
      await this.set(key, freshData, ttlSeconds);
    }
    return freshData;
  }
}

const cache = new CacheService();
module.exports = cache;
