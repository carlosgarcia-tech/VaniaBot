/**
 * CacheManager.ts
 *
 * Unified caching system for permissions, group metadata, users, and message deduplication.
 * Uses LRU cache with TTL support for optimal performance.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
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

  setPermissions(groupJid: string, userJid: string, perms: PermissionData): void {
    const key = `${groupJid}:${userJid}`;
    this.permissionsCache.set(key, perms);
  }

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

  getGroupMetadata(groupJid: string): GroupMetadata | null {
    const cached = this.groupMetadataCache.get(groupJid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  setGroupMetadata(groupJid: string, metadata: GroupMetadata): void {
    this.groupMetadataCache.set(groupJid, metadata);
    const participants = metadata.participants.map(p => p.id);
    this.participantsCache.set(groupJid, participants);
  }

  async getGroupMetadataSafe(sock: WASocket, groupJid: string): Promise<GroupMetadata> {
    const cached = this.getGroupMetadata(groupJid);
    if (cached) return cached;

    const metadata = await sock.groupMetadata(groupJid);
    this.setGroupMetadata(groupJid, metadata);
    return metadata;
  }

  invalidateGroupMetadata(groupJid: string): void {
    this.groupMetadataCache.delete(groupJid);
    this.participantsCache.delete(groupJid);
    this.invalidatePermissions(groupJid);
  }

  getGroupParticipants(groupJid: string): string[] | null {
    const cached = this.participantsCache.get(groupJid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  setGroupParticipants(groupJid: string, participants: string[]): void {
    this.participantsCache.set(groupJid, participants);
  }

  getUser(jid: string): CachedUser | null {
    const cached = this.userCache.get(jid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  setUser(jid: string, user: CachedUser): void {
    this.userCache.set(jid, user);
  }

  invalidateUser(jid: string): void {
    this.userCache.delete(jid);
  }

  hasProcessedMessage(messageId: string): boolean {
    return this.messageIdCache.has(messageId);
  }

  markMessageProcessed(messageId: string): void {
    this.messageIdCache.add(messageId);
  }

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

  stop(): void {
    if (this.messageIdCacheTimer) {
      clearInterval(this.messageIdCacheTimer);
      this.messageIdCacheTimer = null;
    }
    this.clear();
  }

  clear(): void {
    this.permissionsCache.clear();
    this.groupMetadataCache.clear();
    this.participantsCache.clear();
    this.userCache.clear();
    this.messageIdCache.clear();
  }
}

export const cacheManager = new UnifiedCacheManager();
