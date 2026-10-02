import type { MessageContext } from '@/types/index.js';

interface TargetUserResult {
  jid: string;
  fromQuoted: boolean;
}

/**
 * Extracts the target user JID from a message context.
 * Checks for mentioned users first, then quoted messages.
 *
 * @param ctx - The message context.
 * @returns An object with the target JID and source, or null if no target found.
 */
export function getTargetUser(ctx: MessageContext): TargetUserResult | null {
  const mentionedJid = ctx.mentionedJid;
  const quotedJid = ctx.quotedParticipant;

  if (mentionedJid) {
    return { jid: mentionedJid, fromQuoted: false };
  }

  if (quotedJid) {
    return { jid: quotedJid, fromQuoted: true };
  }

  return null;
}

/**
 * Generates a standard error message for operations requiring a target user.
 *
 * @param operation - The operation description.
 * @returns A formatted error message.
 */
export function getErrorMessage(operation: string): string {
  return `You must mention a user or reply to their message to ${operation}`;
}