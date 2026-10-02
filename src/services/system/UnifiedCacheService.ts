/**
 * UnifiedCacheService.ts
 *
 * Two-tier cache facade: an in-process LRU in front of Redis.
 *
 * Reads hit memory first and only fall through to Redis on a miss; writes go to
 * both tiers. That keeps the hot path free of network round-trips while still
 * sharing state across processes (main bot and sub-bots, or multiple
 * instances).
 *
 * Every Redis call is individually wrapped: if Redis fails while believed to be
 * ready, the failure is logged and the operation degrades to memory-only rather
 * than throwing into the caller.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { redisCache, type CacheStats } from './RedisCacheService.js';
import { createCache, type LruMemoryCache } from './MemoryCacheService.js';
import { logger } from '@/utils/logger.js';

export interface UnifiedCacheOptions {
  /** Set false to stay memory-only. */
  useRedis: boolean;
  redisUrl?: string;
  /** Default TTL in seconds (converted to ms for the memory tier). */
  ttl: number;
  prefix: string;
}

const DEFAULT_OPTIONS: UnifiedCacheOptions = {
  useRedis: true,
  ttl: 300,
  prefix: 'vania:',
};

export class UnifiedCacheService {
  private static instance: UnifiedCacheService;
  private options: UnifiedCacheOptions;
  /** Latched at initialize(); a later Redis outage does not clear it. */
  private redisReady = false;
  private memoryCache: LruMemoryCache<unknown>;

  private constructor(options: Partial<UnifiedCacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.memoryCache = createCache<unknown>({
      maxSize: 2000,
      ttl: this.options.ttl * 1000,
      cleanupInterval: 60000,
    });
  }

  static getInstance(options?: Partial<UnifiedCacheOptions>): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService(options);
    }
    return UnifiedCacheService.instance;
  }

  /**
   * Connects Redis when enabled.
   * Never throws: on failure the service stays usable in memory-only mode.
   */
  async initialize(): Promise<void> {
    if (this.options.useRedis) {
      try {
        this.redisReady = await redisCache.connect(this.options.redisUrl);
        logger.info(`Cache initialized: ${this.redisReady ? 'Redis' : 'Memory'}`);
      } catch (error) {
        logger.warn('Redis init failed, using memory cache', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        this.redisReady = false;
      }
    }
  }

  private getKey(key: string): string {
    return `${this.options.prefix}${key}`;
  }

  /**
   * Reads a value: memory first, then Redis.
   * @returns The value, or null when absent in both tiers.
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);

    if (this.redisReady) {
      try {
        const result = await redisCache.get<T>(fullKey);
        if (result !== null) {
          return result;
        }
      } catch (error) {
        // Redis caído con redisReady=true: sin este log el fallo de capa
        // era invisible (todo caía al fallback de memoria en silencio).
        logger.warn(`[UnifiedCache] Redis GET failed for ${fullKey}:`, error);
      }
    }

    return this.memoryCache.get(fullKey) as T | null;
  }

  /** Writes to both tiers. @param ttl Lifetime in seconds. */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key);

    this.memoryCache.set(fullKey, value, ttl);

    if (this.redisReady) {
      try {
        await redisCache.set(fullKey, value, ttl);
      } catch (error) {
        logger.warn(`[UnifiedCache] Redis SET failed for ${fullKey}:`, error);
      }
    }
  }

  /** Removes a key from both tiers. */
  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);

    this.memoryCache.delete(fullKey);

    if (this.redisReady) {
      try {
        await redisCache.delete(fullKey);
      } catch (error) {
        logger.warn(`[UnifiedCache] Redis DELETE failed for ${fullKey}:`, error);
      }
    }
  }

  /** True when the key is present in either tier; memory is checked first. */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getKey(key);

    if (this.memoryCache.has(fullKey)) {
      return true;
    }

    if (this.redisReady) {
      try {
        return await redisCache.exists(fullKey);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Clears the cache.
   * The memory tier is always emptied in full; a Redis pattern only narrows the
   * remote side.
   */
  async clear(pattern?: string): Promise<void> {
    const fullPattern = pattern ? this.getKey(pattern) : undefined;

    this.memoryCache.clear();

    if (this.redisReady) {
      try {
        await redisCache.clear(fullPattern);
      } catch (error) {
        logger.warn(`[UnifiedCache] Redis CLEAR failed:`, error);
      }
    }
  }

  getMemoryStats() {
    return this.memoryCache.getStats();
  }

  /** Redis stats, or null when Redis is not in use. */
  getRedisStats(): CacheStats | null {
    if (!this.redisReady) return null;
    return redisCache.getStats();
  }

  isRedisConnected(): boolean {
    return this.redisReady;
  }
}

export const unifiedCache = UnifiedCacheService.getInstance();
