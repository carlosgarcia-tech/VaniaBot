/**
 * MiddlewareCache.ts
 *
 * Short-lived caches used by the middleware chain, separate from the main
 * CacheManager.
 *
 * These hold data that middleware needs on *every* message (mute flags, admin
 * -only mode, permissions). Reading them from the database each time would add a
 * query to the hot path, so they are cached aggressively here and invalidated
 * explicitly whenever settings change.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { LRUCache } from 'lru-cache';

interface MiddlewareCacheOptions {
  /** Maximum entries before LRU eviction. */
  maxSize: number;
  /** Entry lifetime in milliseconds. */
  ttlMs: number;
}

/** Generic bounded cache wrapper; values are stored untyped for reuse. */
export class MiddlewareCache {
  private cache: LRUCache<string, {}>;
  private readonly ttlMs: number;

  constructor(options: MiddlewareCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.cache = new LRUCache<string, {}>({
      max: options.maxSize,
      ttl: options.ttlMs,
      updateAgeOnGet: true,
      allowStale: false,
    });
  }

  get<T extends {}>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  set<T extends {}>(key: string, value: T): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Drops every entry whose key starts with `prefix`.
   * Used to invalidate all entries belonging to a group or user at once.
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/** Owns one cache per concern, with the TTL that suits each. */
export class MiddlewareCacheManager {
  private static instance: MiddlewareCacheManager;

  /** Mute flags. Long TTL: changes go through explicit invalidation. */
  readonly userMuted: MiddlewareCache;
  /** Resolved permissions. Short TTL, so demotions take effect quickly. */
  readonly userPermissions: MiddlewareCache;
  /** Per-group admin-only flag. */
  readonly onlyAdminMode: MiddlewareCache;

  private constructor() {
    this.userMuted = new MiddlewareCache({
      maxSize: 500,
      ttlMs: 24 * 60 * 60 * 1000,
    });

    this.userPermissions = new MiddlewareCache({
      maxSize: 300,
      ttlMs: 60 * 1000,
    });

    this.onlyAdminMode = new MiddlewareCache({
      maxSize: 200,
      ttlMs: 30 * 1000,
    });
  }

  static getInstance(): MiddlewareCacheManager {
    if (!MiddlewareCacheManager.instance) {
      MiddlewareCacheManager.instance = new MiddlewareCacheManager();
    }
    return MiddlewareCacheManager.instance;
  }

  invalidateGroup(groupJid: string): void {
    this.onlyAdminMode.invalidateByPrefix(groupJid + ':');
  }

  invalidateUser(userJid: string): void {
    this.userMuted.invalidateByPrefix(userJid + ':');
    this.userPermissions.invalidateByPrefix(userJid + ':');
  }

  invalidateAll(): void {
    this.userMuted.clear();
    this.userPermissions.clear();
    this.onlyAdminMode.clear();
  }

  clear(): void {
    this.invalidateAll();
  }
}

export const middlewareCache = MiddlewareCacheManager.getInstance();
