/**
 * fixtures.ts
 *
 * Construcción de WAMessage válidos (forma Baileys real) para el harness
 * e2e. Los timestamps van en segundos —como los manda WhatsApp— y son
 * posteriores al arranque del bot para no caer en el filtro de ecos
 * offline de MainMessagePipeline.isPreStartupEcho.
 */

import type { proto, WAMessage } from 'baileys';

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
 * y comparte estado durante todo el boot). Acepta índices de hasta 4
 * dígitos.
 */
export function senderJid(n: number): string {
  return `86123456789${String(n).padStart(6, '0')}@s.whatsapp.net`;
}

/** Nombre push configurable, por si un test lo necesita. */
function withPushName(msg: WAMessage, pushName: string): WAMessage {
  return { ...msg, pushName };
}

/** Mensaje de texto entrante en un chat privado. */
export function dmTextMessage(text: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return { ...msg, message: { conversation: text } };
}

/**
 * Mensaje de texto simple en grupo. El remitente (participant) es
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

/** Variante de grupo con nombre push distinto (lo usa el kick por spam). */
export function groupMessageFrom(
  groupJid: string,
  sender: string,
  text: string,
  pushName: string,
): WAMessage {
  const msg = baseMessage(groupJid);
  return withPushName(
    {
      ...msg,
      key: { ...msg.key, participant: sender },
      message: { conversation: text },
    },
    pushName,
  );
}

/** Mention JID con el texto de referencia en un grupo. */
export function groupMentionMessage(
  text: string,
  groupJid: string,
  sender: string,
  mentionedJid: string,
  pushName = 'Admin',
): WAMessage {
  const msg = baseMessage(groupJid);
  return withPushName(
    {
      ...msg,
      key: { ...msg.key, participant: sender },
      message: {
        extendedTextMessage: {
          text,
          contextInfo: { mentionedJid: [mentionedJid] },
        },
      },
    },
    pushName,
  );
}

/** Texto extendido en DM (respuesta a otro mensaje, como el de WhatsApp). */
export function dmExtendedTextMessage(text: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    message: { extendedTextMessage: { text } },
  };
}

/** Texto extendido en grupo, con contexto de mención. */
export function groupExtendedTextMessage(
  text: string,
  groupJid: string,
  sender: string,
  contextInfo?: proto.IContextInfo,
): WAMessage {
  const msg = baseMessage(groupJid);
  return {
    ...msg,
    key: { ...msg.key, participant: sender },
    message: { extendedTextMessage: { text, contextInfo } },
  };
}

/** Imagen con caption: MessageContext extrae el caption como texto. */
export function dmImageCaptionMessage(caption: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    message: { imageMessage: { caption, mimetype: 'image/jpeg', url: 'https://example/i.jpg' } },
  };
}

/** Sticker sin texto: no debe ejecutar ningún comando. */
export function dmStickerMessage(sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    message: { stickerMessage: { mimetype: 'image/webp', url: 'https://example/s.webp' } },
  };
}

/** Mensaje marcado como propio (key.fromMe): el pipeline lo ignora. */
export function dmFromMeMessage(text: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    key: { ...msg.key, fromMe: true },
    message: { conversation: text },
  };
}

/** Reacción a un mensaje previo: entra por handleReaccion, no por comandos. */
export function dmReactionMessage(
  sender: string,
  targetId: string,
  emoji = '👍',
): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    message: {
      reactionMessage: {
        key: { remoteJid: msg.key.remoteJid, id: targetId, fromMe: false },
        text: emoji,
      },
    },
  };
}
