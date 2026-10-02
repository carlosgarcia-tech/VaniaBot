import type { WASocket, GroupParticipant } from 'baileys';
import {
  normalizeJid,
  isLidJid,
  GroupMetadataCache,
  LidResolver,
  UserPermissionChecker,
  BotPermissionChecker,
} from './permission/index.js';

export { normalizeJid, isLidJid, getBotJid, getBotLid, getBotPhone } from './permission/index.js';
export { GroupMetadataCache, LidResolver } from './permission/index.js';
export { UserPermissionChecker, type UserPermissions } from './permission/index.js';
export { BotPermissionChecker, type BotPermissions } from './permission/index.js';

export interface GroupMetadataLike {
  participants: GroupParticipant[];
  subject: string;
  desc?: string;
}

export const PermissionService = {
  isOwner: (jid: string) => UserPermissionChecker.isOwner(jid),

  isOwnerAsync: (sock: WASocket, jid: string) => UserPermissionChecker.isOwnerAsync(sock, jid),

  invalidateCache: (groupJid: string) => GroupMetadataCache.invalidate(groupJid),

  clearCache: () => {
    GroupMetadataCache.clear();
    LidResolver.clearCache();
  },

  getUserPermissions: (sock: WASocket, groupJid: string | undefined, userJid: string) =>
    UserPermissionChecker.getPermissions(sock, groupJid, userJid),

  getBotPermissions: (sock: WASocket, groupJid: string) =>
    BotPermissionChecker.getPermissions(sock, groupJid),

  canBotModerate: (sock: WASocket, groupJid: string) =>
    BotPermissionChecker.canModerate(sock, groupJid),

  canUserModerate: (sock: WASocket, groupJid: string, userJid: string) =>
    UserPermissionChecker.canModerate(sock, groupJid, userJid),

  getGroupAdmins: async (sock: WASocket, groupJid: string): Promise<string[]> => {
    const metadata = await GroupMetadataCache.fetch(sock, groupJid);
    if (!metadata) return [];
    return metadata.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => p.id);
  },

  isUserInGroup: async (sock: WASocket, groupJid: string, userJid: string): Promise<boolean> => {
    const metadata = await GroupMetadataCache.fetch(sock, groupJid);
    if (!metadata) return false;

    if (isLidJid(userJid)) {
      return metadata.participants.some(p => normalizeJid(p.id) === normalizeJid(userJid));
    }

    const { extractPhone } = await import('./permission/JidService.js');
    const userPhone = extractPhone(userJid);
    const participants = metadata.participants;

    for (const p of participants) {
      if (isLidJid(p.id)) {
        const resolvedPhone = await LidResolver.resolve(sock, p.id);
        if (resolvedPhone === userPhone) return true;
      } else {
        if (extractPhone(p.id) === userPhone) return true;
      }
    }
    return false;
  },
};
