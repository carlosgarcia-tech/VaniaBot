/**
 * GroupMetadataCache.ts
 *
 * VaniaBot services module exposing `GroupMetadataCache`.
 *
 * @author **Carlos G**
 */

import type { WASocket, GroupParticipant } from 'baileys';
import { logError } from '@/utils/logger.js';
import { cacheManager } from '@/core/CacheManager.js';

interface GroupMetadataLike {
  participants: GroupParticipant[];
  subject: string;
  desc?: string;
}

interface CacheEntry {
  data: GroupMetadataLike;
  timestamp: number;
}

export class GroupMetadataCache {
  private static cache = new Map<string, CacheEntry>();
  private static readonly TTL_MS = 5 * 60 * 1000;

  static get(groupJid: string): GroupMetadataLike | null {
    const cached = this.cache.get(groupJid);
    if (cached && Date.now() - cached.timestamp < this.TTL_MS) {
      return cached.data;
    }
    return null;
  }

  static set(groupJid: string, data: GroupMetadataLike): void {
    this.cache.set(groupJid, { data, timestamp: Date.now() });
  }

  static invalidate(groupJid: string): void {
    this.cache.delete(groupJid);
  }

  static clear(): void {
    this.cache.clear();
  }

  static async fetch(sock: WASocket, groupJid: string): Promise<GroupMetadataLike | null> {
    const cached = this.get(groupJid);
    if (cached) return cached;

    try {
      const metadata = await cacheManager.getGroupMetadataSafe(sock, groupJid);
      this.set(groupJid, metadata);
      return metadata;
    } catch (error) {
      logError(`Error obtaining group metadata for ${groupJid}:`, error);
      return null;
    }
  }
}
