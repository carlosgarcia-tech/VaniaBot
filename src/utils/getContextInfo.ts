/**
 * getContextInfo.ts
 *
 * Normalises reply metadata out of a WhatsApp message.
 *
 * Baileys nests `contextInfo` inside whichever sub-message matches the type the
 * user replied to, so callers would otherwise need to probe every variant. This
 * collapses them into a single lookup.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { proto } from 'baileys';

/**
 * Extracts the `contextInfo` (quoted message, stanzaId, participant, etc.)
 * from a WhatsApp message, regardless of the message type.
 *
 * Baileys stores the contextInfo inside the specific sub-message that
 * corresponds to the type of message the user sent when replying:
 *  - plain text (reply)       -> extendedTextMessage.contextInfo
 *  - image (reply)            -> imageMessage.contextInfo
 *  - video (reply)            -> videoMessage.contextInfo
 *  - sticker (reply)          -> stickerMessage.contextInfo
 *  - document (reply)         -> documentMessage.contextInfo
 *  - document with caption    -> documentWithCaptionMessage.message.documentMessage.contextInfo
 *  - audio (reply)            -> audioMessage.contextInfo
 *  - viewOnce (reply)         -> viewOnceMessage.message.extendedTextMessage.contextInfo
 *  - ephemeral (reply)        -> ephemeralMessage.message.extendedTextMessage.contextInfo
 */

/**
 * Returns the reply context (quoted message, stanzaId, participant, mentions),
 * or undefined when the message is not a reply.
 */
export function getContextInfo(
  msg: proto.IMessage | null | undefined,
): proto.IContextInfo | undefined {
  if (!msg) return undefined;

  return (
    msg.extendedTextMessage?.contextInfo ??
    msg.imageMessage?.contextInfo ??
    msg.videoMessage?.contextInfo ??
    msg.stickerMessage?.contextInfo ??
    msg.documentMessage?.contextInfo ??
    msg.audioMessage?.contextInfo ??
    msg.documentWithCaptionMessage?.message?.documentMessage?.contextInfo ??
    msg.viewOnceMessage?.message?.extendedTextMessage?.contextInfo ??
    msg.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ??
    undefined
  );
}
