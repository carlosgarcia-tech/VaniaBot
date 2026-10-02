/**
 * CacheManager.ts
 *
 * Unified caching system for permissions, group metadata, users, and message deduplication.
 * Uses LRU cache with TTL support for optimal performance.
 */

import { LRUCache } from 'lru-cache';
import type { GroupMetadata, WASocket } from 'baileys';
import type { UserPermissions, BotPermissions } from '@/services/PermissionService.js';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * The cache stores either user or bot permissions depending on which was set.
 * Using a union keeps it compatible with both callers in MessageContext.
 */
export type PermissionData = UserPermissions | BotPermissions;

/**
 * Minimal user shape stored in cache.
 * Should match (or be a subset of) your User type from UserService.
 */
export interface CachedUser {
  jid: string;
  name: string;
  level: number;
  xp: number;
  money: number;
  [key: string]: unknown;
}

/**
 * Unified cache manager for all caching needs.
 * Manages permissions, group metadata, users, and message deduplication.
 */
export class UnifiedCacheManager {
  private permissionsCache: LRUCache<string, PermissionData>;
  private groupMetadataCache: LRUCache<string, GroupMetadata>;
  private userCache: LRUCache<string, CachedUser>;
  private participantsCache: LRUCache<string, string[]>;
  private messageIdCache: Set<string>;
  private messageIdCacheTimer: ReturnType<typeof setInterval> | null = null;

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor() {
    this.permissionsCache = new LRUCache({
      max: 200,
      ttl: 2 * 60 * 1000,
      updateAgeOnGet: true,
      allowStale: false,
    });

    this.groupMetadataCache = new LRUCache({
      max: 100,
      ttl: 5 * 60 * 1000,
      updateAgeOnGet: true,
    });

    this.userCache = new LRUCache({
      max: 2000,
      ttl: 10 * 60 * 1000,
      updateAgeOnGet: true,
    });

    this.participantsCache = new LRUCache({
      max: 50,
      ttl: 3 * 60 * 1000,
      updateAgeOnGet: true,
    });

    this.messageIdCache = new Set();
    this.messageIdCacheTimer = setInterval(
      () => {
        this.messageIdCache.clear();
      },
      3 * 60 * 1000,
    );
  }

  /**
   * Gets cached permissions for a user in a group.
   *
   * @param groupJid - The group JID.
   * @param userJid - The user JID.
   * @returns The cached permissions, or null if not found.
   */
  getPermissions(groupJid: string, userJid: string): PermissionData | null {
    const key = `${groupJid}:${userJid}`;
    const cached = this.permissionsCache.get(key);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * Sets permissions for a user in a group.
   *
   * @param groupJid - The group JID.
   * @param userJid - The user JID.
   * @param perms - The permissions to cache.
   */
  setPermissions(groupJid: string, userJid: string, perms: PermissionData): void {
    const key = `${groupJid}:${userJid}`;
    this.permissionsCache.set(key, perms);
  }

  /**
   * Invalidates permissions cache for a group or all groups.
   *
   * @param groupJid - Optional group JID. If not provided, clears all permissions.
   */
  invalidatePermissions(groupJid?: string): void {
    if (groupJid) {
      for (const key of this.permissionsCache.keys()) {
        if (key.startsWith(groupJid + ':')) {
          this.permissionsCache.delete(key);
        }
      }
    } else {
      this.permissionsCache.clear();
    }
  }

  /**
   * Gets cached group metadata.
   *
   * @param groupJid - The group JID.
   * @returns The cached group metadata, or null if not found.
   */
  getGroupMetadata(groupJid: string): GroupMetadata | null {
    const cached = this.groupMetadataCache.get(groupJid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * Sets group metadata in cache.
   *
   * @param groupJid - The group JID.
   * @param metadata - The group metadata to cache.
   */
  setGroupMetadata(groupJid: string, metadata: GroupMetadata): void {
    this.groupMetadataCache.set(groupJid, metadata);
    const participants = metadata.participants.map(p => p.id);
    this.participantsCache.set(groupJid, participants);
  }

  /**
   * Gets group metadata from cache or fetches from WhatsApp.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID.
   * @returns A promise that resolves to the group metadata.
   */
  async getGroupMetadataSafe(sock: WASocket, groupJid: string): Promise<GroupMetadata> {
    const cached = this.getGroupMetadata(groupJid);
    if (cached) return cached;

    const metadata = await sock.groupMetadata(groupJid);
    this.setGroupMetadata(groupJid, metadata);
    return metadata;
  }

  /**
   * Invalidates group metadata and related caches.
   *
   * @param groupJid - The group JID.
   */
  invalidateGroupMetadata(groupJid: string): void {
    this.groupMetadataCache.delete(groupJid);
    this.participantsCache.delete(groupJid);
    this.invalidatePermissions(groupJid);
  }

  /**
   * Gets cached group participants.
   *
   * @param groupJid - The group JID.
   * @returns The cached participants array, or null if not found.
   */
  getGroupParticipants(groupJid: string): string[] | null {
    const cached = this.participantsCache.get(groupJid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * Sets group participants in cache.
   *
   * @param groupJid - The group JID.
   * @param participants - The participants array to cache.
   */
  setGroupParticipants(groupJid: string, participants: string[]): void {
    this.participantsCache.set(groupJid, participants);
  }

  /**
   * Gets cached user data.
   *
   * @param jid - The user JID.
   * @returns The cached user data, or null if not found.
   */
  getUser(jid: string): CachedUser | null {
    const cached = this.userCache.get(jid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * Sets user data in cache.
   *
   * @param jid - The user JID.
   * @param user - The user data to cache.
   */
  setUser(jid: string, user: CachedUser): void {
    this.userCache.set(jid, user);
  }

  /**
   * Invalidates a user from cache.
   *
   * @param jid - The user JID.
   */
  invalidateUser(jid: string): void {
    this.userCache.delete(jid);
  }

  /**
   * Checks if a message ID has been processed.
   *
   * @param messageId - The message ID.
   * @returns True if the message has been processed.
   */
  hasProcessedMessage(messageId: string): boolean {
    return this.messageIdCache.has(messageId);
  }

  /**
   * Marks a message as processed.
   *
   * @param messageId - The message ID.
   */
  markMessageProcessed(messageId: string): void {
    this.messageIdCache.add(messageId);
  }

  /**
   * Gets cache statistics.
   *
   * @returns An object with hits, misses, hit rate, and cache sizes.
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%',
      sizes: {
        permissions: this.permissionsCache.size,
        metadata: this.groupMetadataCache.size,
        participants: this.participantsCache.size,
        users: this.userCache.size,
        messages: this.messageIdCache.size,
      },
    };
  }

  /**
   * Stops the cache manager and clears all caches.
   */
  stop(): void {
    if (this.messageIdCacheTimer) {
      clearInterval(this.messageIdCacheTimer);
      this.messageIdCacheTimer = null;
    }
    this.clear();
  }

  /**
   * Clears all caches.
   */
  clear(): void {
    this.permissionsCache.clear();
    this.groupMetadataCache.clear();
    this.participantsCache.clear();
    this.userCache.clear();
    this.messageIdCache.clear();
  }
}

export const cacheManager = new UnifiedCacheManager();