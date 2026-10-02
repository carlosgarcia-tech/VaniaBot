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

/**
 * Central permission service providing unified access to permission checking utilities.
 */
export const PermissionService = {
  /**
   * Checks if a JID belongs to the bot owner.
   *
   * @param jid - The JID to check.
   * @returns True if the JID is an owner.
   */
  isOwner: (jid: string) => UserPermissionChecker.isOwner(jid),

  /**
   * Checks if a JID belongs to the bot owner (async version for LID resolution).
   *
   * @param sock - The WhatsApp socket.
   * @param jid - The JID to check.
   * @returns A promise that resolves to true if the JID is an owner.
   */
  isOwnerAsync: (sock: WASocket, jid: string) => UserPermissionChecker.isOwnerAsync(sock, jid),

  /**
   * Invalidates the group metadata cache for a specific group.
   *
   * @param groupJid - The group JID.
   */
  invalidateCache: (groupJid: string) => GroupMetadataCache.invalidate(groupJid),

  /**
   * Clears all permission caches.
   */
  clearCache: () => {
    GroupMetadataCache.clear();
    LidResolver.clearCache();
  },

  /**
   * Gets user permissions for a group.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID (optional for private chats).
   * @param userJid - The user JID.
   * @returns A promise that resolves to the user permissions.
   */
  getUserPermissions: (sock: WASocket, groupJid: string | undefined, userJid: string) =>
    UserPermissionChecker.getPermissions(sock, groupJid, userJid),

  /**
   * Gets bot permissions for a group.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID.
   * @returns A promise that resolves to the bot permissions.
   */
  getBotPermissions: (sock: WASocket, groupJid: string) =>
    BotPermissionChecker.getPermissions(sock, groupJid),

  /**
   * Checks if the bot can moderate in a group.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID.
   * @returns A promise that resolves to true if the bot can moderate.
   */
  canBotModerate: (sock: WASocket, groupJid: string) =>
    BotPermissionChecker.canModerate(sock, groupJid),

  /**
   * Checks if a user can moderate in a group.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID.
   * @param userJid - The user JID.
   * @returns A promise that resolves to true if the user can moderate.
   */
  canUserModerate: (sock: WASocket, groupJid: string, userJid: string) =>
    UserPermissionChecker.canModerate(sock, groupJid, userJid),

  /**
   * Gets the list of group admin JIDs.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID.
   * @returns A promise that resolves to an array of admin JIDs.
   */
  getGroupAdmins: async (sock: WASocket, groupJid: string): Promise<string[]> => {
    const metadata = await GroupMetadataCache.fetch(sock, groupJid);
    if (!metadata) return [];
    return metadata.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => p.id);
  },

  /**
   * Checks if a user is a member of a group.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID.
   * @param userJid - The user JID.
   * @returns A promise that resolves to true if the user is in the group.
   */
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