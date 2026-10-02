/**
 * MemoryCacheService.ts
 *
 * Generic in-process LRU+TTL cache.
 *
 * Distinct from core/CacheManager (WhatsApp permissions and group metadata) and
 * system/UnifiedCacheService (Redis or in-memory tiering): this is the small,
 * dependency-free building block used wherever a local cache with an explicit
 * TTL is enough.
 *
 * Expiry is lazy — checked on read — plus a periodic sweep that also enforces
 * the size bound, so abandoned entries cannot leak.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { logError } from '@/utils/logger.js';

/** One stored value plus its expiry and access metadata. */
export interface CacheEntry<T> {
  value: T;
  /** Absolute expiry timestamp in epoch milliseconds. */
  expiry: number;
  /** Access count, used for eviction ordering. */
  hits: number;
  /** Last read/write timestamp, used for LRU eviction. */
  lastAccessed: number;
}

/** Size bound, default TTL and sweep interval. */
export interface MemoryCacheOptions {
  /** Maximum entries before the least recently used is evicted. */
  maxSize: number;
  /** Default entry lifetime in milliseconds. */
  ttl: number;
  /** How often expired entries are swept. */
  cleanupInterval: number;
}

const DEFAULT_OPTIONS: MemoryCacheOptions = {
  maxSize: 1000,
  ttl: 300000,
  cleanupInterval: 60000,
};

export class LruMemoryCache<T> {
  /** Insertion order is not access order: get() re-inserts to refresh recency. */
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: MemoryCacheOptions;
  private cleanupTimer: NodeJS.Timeout | null = null;

  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
  };

  constructor(options: Partial<MemoryCacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startCleanup();
  }

  /**
   * Stores a value, evicting the least recently used entry when full.
   * @param ttl Optional per-entry lifetime override, in milliseconds.
   */
  set(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.options.ttl);

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiry,
      hits: 0,
      lastAccessed: Date.now(),
    });

    this.stats.sets++;
  }

  /**
   * Reads a value, treating expired entries as absent (and deleting them).
   * A hit refreshes recency by re-inserting, which is what makes the eviction
   * order least-recently-used rather than first-in-first-out.
   *
   * @returns The value, or null when missing or expired.
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    entry.lastAccessed = Date.now();

    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  /** Evicts the entry with the oldest `lastAccessed` timestamp. */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Starts the periodic sweep. The timer is unref'd so it never keeps the process
   * alive on its own, and cleanup failures are logged rather than thrown: a bad
   * sweep must not crash the process.
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        logError('[LruMemoryCache] Cleanup error', error);
      }
    }, this.options.cleanupInterval);

    this.cleanupTimer.unref();
  }

  /** Removes expired entries, then trims any excess over the size bound. */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
    }

    if (this.cache.size > this.options.maxSize) {
      const excess = this.cache.size - this.options.maxSize;
      for (let i = 0; i < excess; i++) {
        this.evictOldest();
      }
    }
  }

  /**
   * Cache-aside helper accepting a sync or async factory.
   * Note there is no in-flight de-duplication: concurrent misses all invoke the
   * factory. Use getOrSetAsync when that matters.
   */
  getOrSet(key: string, factory: () => T | Promise<T>, ttl?: number): T | Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = factory();
    if (value instanceof Promise) {
      return value.then(resolved => {
        this.set(key, resolved, ttl);
        return resolved;
      });
    }

    this.set(key, value, ttl);
    return value;
  }

  /** Async-only cache-aside helper; resolves to the cached or freshly built value. */
  async getOrSetAsync(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /** Clears the sweep timer. Cached values are intentionally retained. */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    sets: number;
    evictions: number;
    hitRate: string;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Snapshot of every entry sorted by hit count, for the dashboard.
   * `size` is the JSON length, an approximation for non-serialisable values.
   */
  getEntries(): Array<{ key: string; hits: number; lastAccessed: number; size: number }> {
    const entries: Array<{ key: string; hits: number; lastAccessed: number; size: number }> = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        hits: entry.hits,
        lastAccessed: entry.lastAccessed,
        size: JSON.stringify(entry.value).length,
      });
    }

    return entries.sort((a, b) => b.hits - a.hits);
  }
}

/** Shared cache for general-purpose use; create scoped caches with createCache. */
export const globalCache = new LruMemoryCache<unknown>({
  maxSize: 5000,
  ttl: 300000,
  cleanupInterval: 60000,
});

/** Factory for a typed cache with custom limits. */
export function createCache<T>(options?: Partial<MemoryCacheOptions>): LruMemoryCache<T> {
  return new LruMemoryCache<T>(options);
}
