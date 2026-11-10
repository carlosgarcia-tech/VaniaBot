/**
 * groups.ts
 *
 * Group utilities for the e2e harness: they set the participants returned by
 * FakeWASocket.groupMetadata and invalidate the metadata and permission
 * caches, so PermissionService/UserPermissionChecker/BotPermissionChecker
 * truly hit the fake socket.
 *
 * Without this, `participants: []` means the bot is never an admin and no
 * moderation flow (antilink in kick mode, mutes, spam removal) would be
 * reachable in a test.
 */

import type { FakeParticipant, FakeWASocket } from './FakeWASocket.js';

/** Participant with no permissions (normal group member). */
export function member(id: string): FakeParticipant {
  return { id, admin: 'member' };
}

/** Admin participant of the group. */
export function admin(id: string): FakeParticipant {
  return { id, admin: 'admin' };
}

/** Superadmin participant of the group. */
export function superadmin(id: string): FakeParticipant {
  return { id, admin: 'superadmin' };
}

/** The bot as group admin (JID with the device id, like the real one). */
export function botAdmin(): FakeParticipant {
  return { id: '861234567890123:1@s.whatsapp.net', admin: 'admin' };
}

/**
 * Sets the group participants on the fake socket and clears the
 * metadata/permission caches so the change takes effect immediately.
 */
export async function setParticipants(
  socket: FakeWASocket,
  groupJid: string,
  participants: FakeParticipant[],
): Promise<void> {
  socket.setGroup(groupJid, { participants });

  const [{ cacheManager }, { GroupMetadataCache }, { PermissionService }] = await Promise.all([
    import('@/core/CacheManager.js'),
    import('@/services/permission/GroupMetadataCache.js'),
    import('@/services/PermissionService.js'),
  ]);

  cacheManager.invalidateGroupMetadata(groupJid);
  GroupMetadataCache.invalidate(groupJid);
  PermissionService.invalidateCache(groupJid);
}

/** Same as setParticipants, but emptying the group (bot has no permissions). */
export async function clearParticipants(
  socket: FakeWASocket,
  groupJid: string,
): Promise<void> {
  await setParticipants(socket, groupJid, []);
}
