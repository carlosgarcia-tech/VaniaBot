import { LRUCache } from 'lru-cache';

interface MiddlewareCacheOptions {
  maxSize: number;
  ttlMs: number;
}

/**
 * Generic LRU cache for middleware data with TTL support.
 */
export class MiddlewareCache {
  private cache: LRUCache<string, {}>;
  private readonly ttlMs: number;

  /**
   * Creates a new MiddlewareCache.
   *
   * @param options - Cache configuration options.
   */
  constructor(options: MiddlewareCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.cache = new LRUCache<string, {}>({
      max: options.maxSize,
      ttl: options.ttlMs,
      updateAgeOnGet: true,
      allowStale: false,
    });
  }

  /**
   * Gets a value from the cache.
   *
   * @param key - The cache key.
   * @returns The cached value, or undefined if not found.
   */
  get<T extends {}>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  /**
   * Sets a value in the cache.
   *
   * @param key - The cache key.
   * @param value - The value to cache.
   */
  set<T extends {}>(key: string, value: T): void {
    this.cache.set(key, value);
  }

  /**
   * Checks if a key exists in the cache.
   *
   * @param key - The cache key.
   * @returns True if the key exists.
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Deletes a key from the cache.
   *
   * @param key - The cache key.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidates all keys matching a prefix.
   *
   * @param prefix - The key prefix to match.
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets the current cache size.
   *
   * @returns The number of entries in the cache.
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Manager for middleware caches (singleton).
 * Provides separate caches for muted users, permissions, and admin-only mode.
 */
export class MiddlewareCacheManager {
  private static instance: MiddlewareCacheManager;

  /** Cache for muted user status. */
  readonly userMuted: MiddlewareCache;
  /** Cache for user permissions. */
  readonly userPermissions: MiddlewareCache;
  /** Cache for admin-only mode per group. */
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

  /**
   * Gets the singleton instance.
   *
   * @returns The MiddlewareCacheManager instance.
   */
  static getInstance(): MiddlewareCacheManager {
    if (!MiddlewareCacheManager.instance) {
      MiddlewareCacheManager.instance = new MiddlewareCacheManager();
    }
    return MiddlewareCacheManager.instance;
  }

  /**
   * Invalidates all caches for a group.
   *
   * @param groupJid - The group JID.
   */
  invalidateGroup(groupJid: string): void {
    this.onlyAdminMode.invalidateByPrefix(groupJid + ':');
  }

  /**
   * Invalidates all caches for a user.
   *
   * @param userJid - The user JID.
   */
  invalidateUser(userJid: string): void {
    this.userMuted.invalidateByPrefix(userJid + ':');
    this.userPermissions.invalidateByPrefix(userJid + ':');
  }

  /**
   * Invalidates all caches.
   */
  invalidateAll(): void {
    this.userMuted.clear();
    this.userPermissions.clear();
    this.onlyAdminMode.clear();
  }

  /**
   * Clears all caches (alias for invalidateAll).
   */
  clear(): void {
    this.invalidateAll();
  }
}

export const middlewareCache = MiddlewareCacheManager.getInstance();