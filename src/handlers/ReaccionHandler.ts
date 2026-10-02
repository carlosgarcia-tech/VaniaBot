/**
 * ReaccionHandler.ts
 *
 * Handles emoji reactions to messages in group lists/games.
 * Routes reactions to the ListaManager for game logic processing.
 * This handler is always active regardless of admin-only mode.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { WASocket, proto } from 'baileys';
import { logger } from '@/utils/logger.js';
import { listaManager } from '@/services/game/ListaManager.js';
import { normalizeJid } from '@/services/PermissionService.js';
import { logError } from '@/utils/logger.js';

/**
 * Forwards an incoming reaction to ListaManager for list-game logic.
 *
 * Runs for every reaction regardless of admin-only mode, since reacting to a
 * list entry is normal participation rather than a privileged action. All
 * failures are logged and swallowed: a reaction must never interrupt the
 * pipeline, which treats this as a side channel.
 *
 * @param sock Active Baileys socket.
 * @param message Raw message carrying a `reactionMessage`.
 *
 * @example
 * ```typescript
 * await handleReaccion(sock, message);
 * ```
 */
export async function handleReaccion(
  sock: WASocket,
  message: proto.IWebMessageInfo,
): Promise<void> {
  try {
    const reaccionMsg = message.message?.reactionMessage;
    if (!reaccionMsg) return;

    const targetKey = reaccionMsg.key;
    if (!targetKey?.id) return;

    const messageId = targetKey.id;
    if (!message.key?.remoteJid) return;
    const chatJid = message.key.remoteJid;
    const senderRaw = message.key?.participant ?? message.key?.remoteJid ?? '';
    if (!senderRaw) return;
    const senderJid = normalizeJid(senderRaw);
    const senderNombre = message.pushName || 'User';
    const emoji = reaccionMsg.text ?? '';

    logger.debug(
      `[REACCION DEBUG] messageId=${messageId} chatJid=${chatJid} sender=${senderJid} emoji="${emoji}" sockUser=${sock.user?.id}`,
    );

    const managerAny = listaManager as unknown as { listas: Map<string, unknown> };
    logger.debug(
      `[REACCION DEBUG] listas en memoria: [${Array.from(managerAny.listas.keys()).join(', ')}]`,
    );

    if (!chatJid || !senderJid) return;

    const result = await listaManager.onReaccion(sock, {
      chatJid,
      messageId,
      senderJid,
      senderNombre,
      emoji,
    });

    // A failed reaction is not an error: the user reacted to a message that is
    // not a tracked list entry, which is the common case.
    if (!result.success) {
    }
  } catch (error) {
    logError('[REACCION ERROR]', error);
  }
}
