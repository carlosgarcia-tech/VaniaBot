/**
 * database/DatabaseQueryOptimizer.ts
 *
 * Read-path optimisation: memoises query results and coalesces concurrent
 * identical queries into a single database round-trip.
 *
 * The batching is the interesting part. Several callers asking for the same key
 * in the same few milliseconds are queued by `batchKey`; when the window closes,
 * entries are grouped by key and only the *first* query function is executed,
 * with its result shared by every waiter. This turns an N-way read storm (very
 * common when a command touches several services) into one query.
 *
 * Invalidate explicitly after any write — the cache has no write-through.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { createCache, type LruMemoryCache } from '../system/MemoryCacheService.js';

/** Per-query cache and batching settings. */
export interface QueryOptions {
  /** Set false to always execute the query. */
  cache?: boolean;
  /** Cache lifetime in milliseconds. */
  cacheTtl?: number;
  /** Coalesce concurrent identical queries. */
  batch?: boolean;
  /** Queue this query joins; queries only batch together within one key. */
  batchKey?: string;
  /** How long to wait collecting queries before flushing. */
  batchTimeout?: number;
}

export interface QueryStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  batchedQueries: number;
}

/** Cache on, 30s TTL, batching off. */
const DEFAULT_OPTIONS: Required<QueryOptions> = {
  cache: true,
  cacheTtl: 30000,
  batch: false,
  batchKey: 'default',
  batchTimeout: 100,
};

export class DatabaseQueryOptimizer {
  private static instance: DatabaseQueryOptimizer;
  private cache: LruMemoryCache<unknown>;
  /** Queued queries per batch key. */
  private batchQueues: Map<
    string,
    Array<{
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      key: string;
      queryFn: () => Promise<unknown>;
    }>
  > = new Map();
  /** Pending flush timer per batch key. */
  private batchTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private stats: QueryStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    batchedQueries: 0,
  };

  /** Private: use the exported `queryOptimizer` singleton. */
  private constructor() {
    this.cache = createCache<unknown>({
      maxSize: 5000,
      ttl: 30000,
      cleanupInterval: 60000,
    });
  }

  static getInstance(): DatabaseQueryOptimizer {
    if (!DatabaseQueryOptimizer.instance) {
      DatabaseQueryOptimizer.instance = new DatabaseQueryOptimizer();
    }
    return DatabaseQueryOptimizer.instance;
  }

  /**
   * Runs a query through the cache and (optionally) the batcher.
   *
   * Only successful results are cached, so a transient failure is not pinned for
   * the whole TTL.
   *
   * @param key Cache/batch identity; must fully describe the query's inputs.
   */
  async query<T>(key: string, queryFn: () => Promise<T>, options: QueryOptions = {}): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.stats.totalQueries++;

    if (opts.cache) {
      const cached = this.cache.get(key) as T | undefined;
      if (cached !== undefined) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;
    }

    let result: T;

    if (opts.batch) {
      result = (await this.batchQuery(key, queryFn, opts)) as T;
    } else {
      result = await queryFn();
    }

    if (opts.cache) {
      this.cache.set(key, result, opts.cacheTtl / 1000);
    }

    return result;
  }

  /**
   * Enqueues a query and returns a promise settled when the batch flushes.
   * The flush timer is reset on every enqueue, so the window measures inactivity
   * rather than a fixed deadline.
   */
  private async batchQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    opts: Required<QueryOptions>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.batchQueues.has(opts.batchKey)) {
        this.batchQueues.set(opts.batchKey, []);
      }

      const queue = this.batchQueues.get(opts.batchKey);
      if (!queue) return;

      queue.push({
        key,
        queryFn: queryFn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const existingTimeout = this.batchTimeouts.get(opts.batchKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      this.batchTimeouts.set(
        opts.batchKey,
        setTimeout(() => {
          void this.flushBatch(opts.batchKey);
        }, opts.batchTimeout),
      );
    });
  }

  /**
   * Closes a batch window and resolves everything queued in it.
   * Entries are grouped by key first, so N duplicates collapse to one execution.
   */
  private async flushBatch(batchKey: string): Promise<void> {
    const queue = this.batchQueues.get(batchKey);
    if (!queue || queue.length === 0) return;

    this.batchQueues.delete(batchKey);
    this.batchTimeouts.delete(batchKey);

    const entriesByKey = new Map<string, typeof queue>();
    for (const entry of queue) {
      const group = entriesByKey.get(entry.key);
      if (group) {
        group.push(entry);
      } else {
        entriesByKey.set(entry.key, [entry]);
      }
    }

    const promises: Array<Promise<void>> = [];
    for (const [key, entries] of entriesByKey) {
      promises.push(this.resolveBatchEntries(key, entries));
    }
    await Promise.all(promises);
  }

  /**
   * Executes one key's queued entries.
   *
   * Only `entries[0].queryFn` is called and its result is fanned out — callers
   * must therefore pass an equivalent query function for the same key. A failure
   * rejects every waiter in the group.
   */
  private async resolveBatchEntries(
    key: string,
    entries: Array<{
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      key: string;
      queryFn: () => Promise<unknown>;
    }>,
  ): Promise<void> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      for (const entry of entries) {
        entry.resolve(cached);
      }
      return;
    }

    this.stats.batchedQueries++;
    try {
      const result = await entries[0].queryFn();
      this.cache.set(key, result);
      for (const entry of entries) {
        entry.resolve(result);
      }
    } catch (error) {
      for (const entry of entries) {
        entry.reject(error);
      }
    }
  }

  /** Drops one cached result. Call after writing the underlying data. */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Drops every cached key containing `pattern` (substring match, not a glob). */
  invalidatePattern(pattern: string): void {
    const entries = this.cache.getEntries();
    for (const entry of entries) {
      if (entry.key.includes(pattern)) {
        this.cache.delete(entry.key);
      }
    }
  }

  /** Empties the cache. Queued batches are left to flush on their own. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Query counters plus the underlying cache's own statistics. */
  getStats(): QueryStats & {
    cacheStats: {
      size: number;
      hits: number;
      misses: number;
      sets: number;
      evictions: number;
      hitRate: string;
    };
  } {
    return {
      ...this.stats,
      cacheStats: this.cache.getStats(),
    };
  }
}

export const queryOptimizer = DatabaseQueryOptimizer.getInstance();
