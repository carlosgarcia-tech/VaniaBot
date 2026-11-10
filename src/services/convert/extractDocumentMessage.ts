/**
 * extractDocumentMessage.ts
 *
 * OrbitBot services module exposing `extractDocumentMessage`.
 *
 * @author **Carlos G**
 */

import type { WAMessage } from 'baileys';
import type { MessageContext } from '@/types/index.js';

/**
 * Extracts the WAMessage for an attached document, either quoted
 * or sent directly alongside the command.
 * Returns null if no document is present.
 */
export function extractDocumentMessage(ctx: MessageContext): WAMessage | null {
  const quotedMsg = ctx.quoted;
  const quotedMsgId = ctx.quotedMessageId;
  const quotedParticipant = ctx.quotedParticipant;
  const directMsg = ctx.message.message;

  const quotedDocument = quotedMsg?.documentMessage;
  const directDocument = directMsg?.documentMessage;

  if (quotedDocument) {
    return {
      key: {
        id: quotedMsgId || '',
        remoteJid: quotedParticipant || ctx.chat.jid,
        fromMe: false,
      },
      message: {
        documentMessage: quotedDocument,
      },
      messageTimestamp: Date.now(),
      pushName: '',
      status: 0,
    };
  }

  if (directDocument) {
    return {
      key: {
        id: ctx.message.key?.id || '',
        remoteJid: ctx.message.key?.remoteJid || ctx.chat.jid,
        fromMe: ctx.message.key?.fromMe || false,
      },
      message: {
        documentMessage: directDocument,
      },
      messageTimestamp: Date.now(),
      pushName: '',
      status: 0,
    };
  }

  return null;
}
