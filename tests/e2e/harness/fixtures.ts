/**
 * fixtures.ts
 *
 * Construcción de WAMessage válidos (forma Baileys real) para el harness
 * e2e. Los timestamps van en segundos —como los manda WhatsApp— y son
 * posteriores al arranque del bot para no caer en el filtro de ecos
 * offline de MainMessagePipeline.isPreStartupEcho.
 */

import type { WAMessage } from 'baileys';

const BOT_CREATION_MS = Date.now();
let messageCounter = 0;

/** Marca de tiempo (s) posterior al arranque: pasará el filtro de ecos. */
function timestampSeconds(): number {
  return Math.floor((BOT_CREATION_MS + 60_000) / 1000);
}

function baseMessage(jid: string): WAMessage {
  messageCounter++;
  return {
    key: {
      remoteJid: jid,
      fromMe: false,
      id: `E2E-${messageCounter}-${Math.random().toString(36).slice(2, 8)}`,
      participant: jid.endsWith('@g.us') ? SENDER_JID : undefined,
      participantPronoun: undefined,
    },
    messageTimestamp: timestampSeconds(),
    pushName: 'Tester',
  };
}

/** JID del usuario que "escribe" al bot en los tests. */
export const SENDER_JID = '861234567890123456@s.whatsapp.net';
/** DM directo bot↔usuario (los guards de grupo no aplican). */
export const DM_JID = SENDER_JID;

/**
 * JID de remitente único por índice: cada test usa el suyo para no
 * dispararse entre sí el anti-spam/anti-flood (que limita por remitente
 * y comparte estado durante todo el boot).
 */
export function senderJid(n: number): string {
  return `86123456789012345${n}@s.whatsapp.net`;
}

/** Mensaje de texto entrante en un chat privado. */
export function dmTextMessage(text: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return { ...msg, message: { conversation: text } };
}

/**
 * Mensaje de texto entrante en un grupo. El remitente (participant) es
 * configurable para aislar cooldowns y anti-spam entre tests.
 */
export function groupTextMessage(
  text: string,
  groupJid = '120363019999999999@g.us',
  sender: string = SENDER_JID,
): WAMessage {
  const msg = baseMessage(groupJid);
  return {
    ...msg,
    key: { ...msg.key, participant: sender },
    message: { conversation: text },
  };
}
