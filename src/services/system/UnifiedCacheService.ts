import { redisCache, type CacheStats } from './RedisCacheService.js';
import { createCache, type LruMemoryCache } from './MemoryCacheService.js';
import { logger } from '@/utils/logger.js';

export interface UnifiedCacheOptions {
  useRedis: boolean;
  redisUrl?: string;
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

  getRedisStats(): CacheStats | null {
    if (!this.redisReady) return null;
    return redisCache.getStats();
  }

  isRedisConnected(): boolean {
    return this.redisReady;
  }
}

export const unifiedCache = UnifiedCacheService.getInstance();
