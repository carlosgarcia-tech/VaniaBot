/**
 * groups.ts
 *
 * Utilidades de grupo para el harness e2e: fijan los participantes que
 * devuelve FakeWASocket.groupMetadata e invalidan las caches de metadata
 * y permisos, para que PermissionService/UserPermissionChecker/
 * BotPermissionChecker consulten de verdad al socket falso.
 *
 * Sin esto, `participants: []` hace que el bot nunca sea admin y ningún
 * flujo de moderación (antilink en modo kick, silencios, expulsión por
 * spam) sería alcanzable en un test.
 */

import type { FakeParticipant, FakeWASocket } from './FakeWASocket.js';

/** Participante sin permisos (miembro normal del grupo). */
export function member(id: string): FakeParticipant {
  return { id, admin: 'member' };
}

/** Participante admin del grupo. */
export function admin(id: string): FakeParticipant {
  return { id, admin: 'admin' };
}

/** Participante superadmin del grupo. */
export function superadmin(id: string): FakeParticipant {
  return { id, admin: 'superadmin' };
}

/** El bot como admin del grupo (JID con el device id, como el real). */
export function botAdmin(): FakeParticipant {
  return { id: '861234567890123:1@s.whatsapp.net', admin: 'admin' };
}

/**
 * Define los participantes del grupo en el socket falso y limpia las caches
 * de metadata/permisos para que el cambio surta efecto de inmediato.
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

/** Igual que setParticipants, pero vaciando el grupo (bot sin permisos). */
export async function clearParticipants(
  socket: FakeWASocket,
  groupJid: string,
): Promise<void> {
  await setParticipants(socket, groupJid, []);
}
