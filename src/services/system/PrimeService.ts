/**
 * PrimeService.ts
 *
 * Per-group "Prime" branding: a group that opts in gets its own name embedded in
 * generated content (message footers, sticker pack metadata) instead of the
 * generic bot name.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { WASocket } from 'baileys';
import type { GroupService } from '../database/GroupService.js';
import { cacheManager } from '@/core/CacheManager.js';

export class PrimeService {
  private static instance: PrimeService;
  /** Injected by ServiceManager; required before any method is called. */
  private groupService!: GroupService;
  /** Group avatar URLs, cached to avoid a lookup per generated card. */
  private groupPicCache = new Map<string, { url: string; timestamp: number }>();
  private readonly PIC_CACHE_TTL = 60 * 60 * 1000;

  private constructor() {}

  static getInstance(): PrimeService {
    if (!PrimeService.instance) {
      PrimeService.instance = new PrimeService();
    }
    return PrimeService.instance;
  }

  /** Injects the group service used to read and write the prime flag. */
  setGroupService(groupService: GroupService): void {
    this.groupService = groupService;
  }

  /**
   * Whether a group has Prime enabled.
   * Fails closed (false) on any error, so a broken lookup never accidentally
   * brands a group that did not opt in.
   */
  async isPrimeEnabled(groupJid: string): Promise<boolean> {
    try {
      const group = await this.groupService.getGroup(groupJid);
      return group.prime?.enabled ?? false;
    } catch {
      return false;
    }
  }

  async enablePrime(groupJid: string): Promise<void> {
    await this.groupService.updateGroup(groupJid, {
      prime: { enabled: true },
    });
  }

  async disablePrime(groupJid: string): Promise<void> {
    await this.groupService.updateGroup(groupJid, {
      prime: { enabled: false },
    });
  }

  /**
   * Group subject, via the cached metadata helper.
   * Falls back to a generic label so branding code always has something to show.
   */
  async getGroupName(sock: WASocket, groupJid: string): Promise<string> {
    try {
      const metadata = await cacheManager.getGroupMetadataSafe(sock, groupJid);
      return metadata?.subject || 'Grupo';
    } catch {
      return 'Grupo';
    }
  }

  /**
   * Group avatar URL, cached for PIC_CACHE_TTL.
   * Only successful lookups are cached, so a transient failure is retried on the
   * next call rather than pinning a null result for an hour.
   */
  async getGroupPicUrl(sock: WASocket, groupJid: string): Promise<string | null> {
    const cached = this.groupPicCache.get(groupJid);
    if (cached && Date.now() - cached.timestamp < this.PIC_CACHE_TTL) {
      return cached.url;
    }

    try {
      const picUrl = await sock.profilePictureUrl(groupJid, 'image');
      if (picUrl) {
        this.groupPicCache.set(groupJid, { url: picUrl, timestamp: Date.now() });
      }
      return picUrl || null;
    } catch {
      return null;
    }
  }

  /** Invalidates one group's cached avatar, or all of them when no JID is given. */
  clearGroupPicCache(groupJid?: string): void {
    if (groupJid) {
      this.groupPicCache.delete(groupJid);
    } else {
      this.groupPicCache.clear();
    }
  }

  /**
   * Builds the signature footer appended to generated media.
   * Private chats and non-Prime groups get the generic bot signature.
   */
  async formatFooter(sock: WASocket, groupJid: string, isGroup: boolean): Promise<string> {
    if (!isGroup) {
      return '> VaniaBot💝';
    }

    const primeEnabled = await this.isPrimeEnabled(groupJid);

    if (!primeEnabled) {
      return '> VaniaBot💝';
    }

    const groupName = await this.getGroupName(sock, groupJid);
    return `> ${groupName}💝`;
  }

  /**
   * Sticker pack/author metadata.
   * Prime groups are branded with the group name; everything else uses the default.
   */
  async formatStickerInfo(
    sock: WASocket,
    groupJid: string,
    isGroup: boolean,
  ): Promise<{ pack: string; author: string }> {
    if (!isGroup) {
      return { pack: 'VaniaBot', author: 'VaniaBot' };
    }

    const primeEnabled = await this.isPrimeEnabled(groupJid);

    if (!primeEnabled) {
      return { pack: 'VaniaBot', author: 'VaniaBot' };
    }

    const groupName = await this.getGroupName(sock, groupJid);
    return { pack: groupName, author: groupName };
  }
}

export const primeService = PrimeService.getInstance();
