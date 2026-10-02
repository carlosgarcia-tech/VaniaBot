/**
 * RedisCacheService.ts
 *
 * Shared cache with a transparent in-memory fallback.
 *
 * Every write goes to both Redis and the local map; reads prefer Redis and fall
 * back to memory. That combination means the bot keeps working (degraded to
 * single-instance) when Redis is unavailable or drops mid-run, without callers
 * needing to handle a separate degraded mode — it is also what makes the
 * PIN-verification and toggle services safe to use when Redis is not configured.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { createClient, type RedisClientType } from 'redis';
import { logger } from '@/utils/logger.js';

export interface CacheOptions {
  url?: string;
  /** Default TTL in seconds. */
  ttl: number;
  /** Namespacing prefix, so one Redis instance can host several bots. */
  prefix: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

const DEFAULT_OPTIONS: CacheOptions = {
  ttl: 300,
  prefix: 'vania:',
};

export class RedisCacheService {
  private static instance: RedisCacheService;
  private client: RedisClientType | null = null;
  private options: CacheOptions;
  /**
   * Always-written local mirror of the cached data.
   * Entries store a JSON string (not the raw value) so a fallback read and a
   * Redis read return identically shaped data.
   */
  private memoryCache: Map<string, { value: string; expiry: number }> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };
  private isConnected = false;
  private useMemoryFallback = false;

  private constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  static getInstance(options?: Partial<CacheOptions>): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService(options);
    }
    return RedisCacheService.instance;
  }

  /**
   * Attempts a Redis connection.
   *
   * Never throws: on failure it enables the memory fallback and returns false, so
   * a missing or unreachable Redis cannot prevent the bot from starting.
   *
   * @returns True when Redis is connected.
   */
  async connect(url?: string): Promise<boolean> {
    try {
      const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err: Error) => {
        logger.error('Redis error', { error: err.message });
        this.stats.errors++;
        this.enableMemoryFallback();
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
        this.useMemoryFallback = false;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis disconnected, using memory fallback');
        this.isConnected = false;
        this.useMemoryFallback = true;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      logger.warn('Redis connection failed, using memory fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.enableMemoryFallback();
      return false;
    }
  }

  /**
   * Switches to memory-only mode.
   * Called on connection error, disconnect, and initial connection failure.
   */
  private enableMemoryFallback(): void {
    this.useMemoryFallback = true;
    this.isConnected = false;
    logger.info('Memory cache fallback enabled');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  private getKey(key: string): string {
    return `${this.options.prefix}${key}`;
  }

  /**
   * Reads a value: Redis first, then the memory mirror.
   * @returns The deserialised value, or null when absent in both.
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.useMemoryFallback) {
      return this.memoryGet<T>(key);
    }

    if (!this.client || !this.isConnected) {
      return this.memoryGet<T>(key);
    }

    try {
      const value = await this.client.get(this.getKey(key));

      if (value === null) {
        this.stats.misses++;
        return this.memoryGet<T>(key);
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.memoryGet<T>(key);
    }
  }

  /**
   * Writes a value to both tiers.
   * @param ttl Lifetime in seconds.
   * @returns True even when Redis rejects the write, since the memory copy stands.
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const expiryTime = (ttl || this.options.ttl) * 1000;

    this.memorySet(key, value, expiryTime);

    if (this.useMemoryFallback) {
      return true;
    }

    if (!this.client || !this.isConnected) {
      return true;
    }

    try {
      await this.client.setEx(this.getKey(key), ttl || this.options.ttl, JSON.stringify(value));
      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return true;
    }
  }

  /** Removes a key from both tiers. */
  async delete(key: string): Promise<boolean> {
    this.memoryDelete(key);

    if (this.useMemoryFallback) {
      return true;
    }

    if (!this.client || !this.isConnected) {
      return true;
    }

    try {
      await this.client.del(this.getKey(key));
      this.stats.deletes++;
      return true;
    } catch {
      this.stats.errors++;
      return false;
    }
  }

  /** True when the key exists in either tier; the memory mirror is checked first. */
  async exists(key: string): Promise<boolean> {
    if (this.memoryExists(key)) {
      return true;
    }

    if (this.useMemoryFallback || !this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Clears the cache.
   * @param pattern Optional Redis glob; defaults to everything under the prefix.
   * The memory mirror only drops expired entries.
   */
  async clear(pattern?: string): Promise<void> {
    this.memoryClear();

    if (this.useMemoryFallback || !this.client || !this.isConnected) {
      return;
    }

    try {
      const keys = await this.client.keys(this.getKey(pattern || '*'));
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Cache clear error', { error });
    }
  }

  /** Memory-tier read; expired entries are deleted and reported as a miss. */
  private memoryGet<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return JSON.parse(item.value) as T;
  }

  /** Memory-tier write. `ttl` is milliseconds, unlike the Redis API's seconds. */
  private memorySet<T>(key: string, value: T, ttl: number): void {
    const expiry = Date.now() + ttl;
    this.memoryCache.set(key, {
      value: JSON.stringify(value),
      expiry,
    });
  }

  /** Memory-tier delete. Note this one applies the key prefix, unlike its siblings. */
  private memoryDelete(key: string): void {
    this.memoryCache.delete(this.getKey(key));
  }

  /** Memory-tier existence check; expired entries are deleted and report false. */
  private memoryExists(key: string): boolean {
    const item = this.memoryCache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      return false;
    }
    return true;
  }

  /** Drops only expired memory entries; live data is kept as the fallback cache. */
  private memoryClear(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }

  /** Hit/miss counters plus the current connection and fallback state. */
  getStats(): CacheStats & { hitRate: string; isConnected: boolean; useFallback: boolean } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      isConnected: this.isConnected,
      useFallback: this.useMemoryFallback,
    };
  }

  /** True when the cache is usable, whether via Redis or the memory fallback. */
  isReady(): boolean {
    return this.isConnected || this.useMemoryFallback;
  }
}

export const redisCache = RedisCacheService.getInstance();
