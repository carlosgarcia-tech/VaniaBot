/**
 * UserPermissionChecker.ts
 *
 * VaniaBot services module exposing `UserPermissionChecker`, `UserPermissions`.
 *
 * @author **Carlos G**
 */

import type { WASocket, GroupParticipant } from 'baileys';
import { config } from '@/config/index.js';
import { normalizeJid, extractPhone, isLidJid } from './JidService.js';
import { GroupMetadataCache } from './GroupMetadataCache.js';
import { LidResolver } from './LidResolver.js';

export interface UserPermissions {
  isOwner: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export class UserPermissionChecker {
  static isOwner(jid: string): boolean {
    const normalizedJid = normalizeJid(jid);
    const phoneNumber = extractPhone(normalizedJid);

    for (const owner of config.owners) {
      const normalizedOwner = normalizeJid(owner);
      const ownerPhone = extractPhone(normalizedOwner);
      if (normalizedJid === normalizedOwner) return true;
      if (phoneNumber === ownerPhone) return true;
      if (
        isLidJid(normalizedJid) &&
        isLidJid(normalizedOwner) &&
        normalizedJid === normalizedOwner
      ) {
        return true;
      }
    }
    return false;
  }

  static async isOwnerAsync(sock: WASocket, jid: string): Promise<boolean> {
    const normalizedJid = normalizeJid(jid);
    const phoneNumber = extractPhone(normalizedJid);

    if (isLidJid(normalizedJid)) {
      const cachedPhone = LidResolver['lidPhoneCache'].get(normalizedJid);
      if (cachedPhone) {
        return config.owners.some(owner => extractPhone(normalizeJid(owner)) === cachedPhone);
      }
      const resolvedPhone = await LidResolver.resolve(sock, normalizedJid);
      if (resolvedPhone) {
        return config.owners.some(owner => extractPhone(normalizeJid(owner)) === resolvedPhone);
      }
      return config.owners.some(owner => normalizedJid === normalizeJid(owner));
    }

    return config.owners.some(owner => {
      const normalizedOwner = normalizeJid(owner);
      return normalizedJid === normalizedOwner || phoneNumber === extractPhone(normalizedOwner);
    });
  }

  private static async findParticipantByPhone(
    sock: WASocket,
    participants: GroupParticipant[],
    phoneNumber: string,
  ): Promise<GroupParticipant | null> {
    for (const p of participants) {
      if (isLidJid(p.id)) {
        const resolvedPhone = await LidResolver.resolve(sock, p.id);
        if (resolvedPhone === phoneNumber) return p;
      } else {
        const pPhone = extractPhone(p.id);
        if (pPhone === phoneNumber) return p;
      }
    }
    return null;
  }

  static async getPermissions(
    sock: WASocket,
    groupJid: string | undefined,
    userJid: string,
  ): Promise<UserPermissions> {
    const _userNormalized = normalizeJid(userJid);

    const isOwner = this.isOwner(userJid);

    if (!groupJid) {
      return { isOwner, isAdmin: false, isSuperAdmin: false };
    }

    if (isOwner) {
      return { isOwner: true, isAdmin: true, isSuperAdmin: true };
    }

    const metadata = await GroupMetadataCache.fetch(sock, groupJid);
    if (!metadata) {
      return { isOwner: false, isAdmin: false, isSuperAdmin: false };
    }

    let participant: GroupParticipant | undefined | null;

    if (isLidJid(userJid)) {
      participant = metadata.participants.find(p => normalizeJid(p.id) === normalizeJid(userJid));
    } else {
      participant = await this.findParticipantByPhone(
        sock,
        metadata.participants,
        extractPhone(userJid),
      );
    }

    if (!participant) {
      return { isOwner: false, isAdmin: false, isSuperAdmin: false };
    }

    const isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';

    return {
      isOwner: false,
      isAdmin,
      isSuperAdmin: participant.admin === 'superadmin',
    };
  }

  static async canModerate(sock: WASocket, groupJid: string, userJid: string): Promise<boolean> {
    const permissions = await this.getPermissions(sock, groupJid, userJid);
    return permissions.isOwner || permissions.isAdmin;
  }
}
