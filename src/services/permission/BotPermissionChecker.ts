/**
 * BotPermissionChecker.ts
 *
 * VaniaBot services module exposing `BotPermissionChecker`, `BotPermissions`.
 *
 * @author **Carlos G**
 */

import type { WASocket, GroupParticipant } from 'baileys';
import { logError } from '@/utils/logger.js';
import { normalizeJid, getBotPhone, getBotLid, extractPhone } from './JidService.js';
import { GroupMetadataCache } from './GroupMetadataCache.js';

export interface BotPermissions {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export class BotPermissionChecker {
  static async getPermissions(sock: WASocket, groupJid: string): Promise<BotPermissions> {
    try {
      let metadata = await GroupMetadataCache.fetch(sock, groupJid);

      if (!metadata || metadata.participants.length === 0) {
        GroupMetadataCache.invalidate(groupJid);
        metadata = await sock.groupMetadata(groupJid);
      }

      if (!metadata) {
        return { isAdmin: false, isSuperAdmin: false };
      }

      const botId = sock.user?.id;
      if (!botId) {
        return { isAdmin: false, isSuperAdmin: false };
      }

      const botPhone = getBotPhone(sock);
      const botJidNormalized = normalizeJid(botId);
      const botLid = getBotLid(sock);

      const botParticipant = this.findBotParticipant(metadata.participants, {
        botId,
        botPhone,
        botJidNormalized,
        botLid,
      });

      if (!botParticipant) {
        for (const p of metadata.participants) {
          if (p.admin === 'admin' || p.admin === 'superadmin') {
            return { isAdmin: true, isSuperAdmin: p.admin === 'superadmin' };
          }
        }
        return { isAdmin: false, isSuperAdmin: false };
      }

      const isAdmin = botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin';
      return { isAdmin, isSuperAdmin: botParticipant.admin === 'superadmin' };
    } catch (error) {
      logError('Error getting bot permissions:', error);
      return { isAdmin: false, isSuperAdmin: false };
    }
  }

  private static findBotParticipant(
    participants: GroupParticipant[],
    bot: { botId: string; botPhone: string; botJidNormalized: string; botLid: string | null },
  ): GroupParticipant | undefined {
    for (const p of participants) {
      const pNorm = normalizeJid(p.id);
      if (p.id === bot.botId || pNorm === bot.botJidNormalized) return p;
      if (p.id.includes(bot.botPhone + '@')) return p;
      if (extractPhone(p.id) === bot.botPhone) return p;
    }
    return undefined;
  }

  static async canModerate(sock: WASocket, groupJid: string): Promise<boolean> {
    const permissions = await this.getPermissions(sock, groupJid);
    return permissions.isAdmin;
  }
}
