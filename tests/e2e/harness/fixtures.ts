/**
 * fixtures.ts
 *
 * Building valid WAMessages (real Baileys shape) for the e2e harness.
 * Timestamps are in seconds —as WhatsApp sends them— and postdate the bot's
 * startup so they don't fall into MainMessagePipeline.isPreStartupEcho's
 * offline-echo filter.
 */

import type { proto, WAMessage } from 'baileys';

const BOT_CREATION_MS = Date.now();
let messageCounter = 0;

/** Timestamp (s) after startup: passes the echo filter. */
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

/** JID of the user "messaging" the bot in the tests. */
export const SENDER_JID = '861234567890123456@s.whatsapp.net';
/** Direct bot↔user DM (group guards don't apply). */
export const DM_JID = SENDER_JID;

/**
 * Sender JID unique per index: each test uses its own so they don't
 * trigger each other's anti-spam/anti-flood (which limits per sender and
 * shares state for the whole boot). Accepts indexes up to 4 digits.
 */
export function senderJid(n: number): string {
  return `86123456789${String(n).padStart(6, '0')}@s.whatsapp.net`;
}

/** Configurable push name, in case a test needs one. */
function withPushName(msg: WAMessage, pushName: string): WAMessage {
  return { ...msg, pushName };
}

/** Incoming text message in a private chat. */
export function dmTextMessage(text: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return { ...msg, message: { conversation: text } };
}

/**
 * Simple text message in a group. The sender (participant) is configurable
 * to isolate cooldowns and anti-spam between tests.
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

/** Group variant with a distinct push name (used by the spam kick). */
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

/** Mention JID with reference text in a group. */
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

/** Extended text in a DM (reply to another message, like WhatsApp's). */
export function dmExtendedTextMessage(text: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    message: { extendedTextMessage: { text } },
  };
}

/** Extended text in a group, with mention context. */
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

/** Image with caption: MessageContext extracts the caption as text. */
export function dmImageCaptionMessage(caption: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    message: { imageMessage: { caption, mimetype: 'image/jpeg', url: 'https://example/i.jpg' } },
  };
}

/** Sticker with no text: must not run any command. */
export function dmStickerMessage(sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    message: { stickerMessage: { mimetype: 'image/webp', url: 'https://example/s.webp' } },
  };
}

/** Message marked as own (key.fromMe): the pipeline ignores it. */
export function dmFromMeMessage(text: string, sender: string = SENDER_JID): WAMessage {
  const msg = baseMessage(sender);
  return {
    ...msg,
    key: { ...msg.key, fromMe: true },
    message: { conversation: text },
  };
}

/** Reaction to a previous message: enters via handleReaccion, not commands. */
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
