/**
 * moderationUtils.ts
 *
 * Helpers shared by the moderation commands (ban, kick, mute, warn).
 *
 * These commands all need to answer the same question: "which user is this
 * about?", answered either by an @mention or by replying to someone's message.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { MessageContext } from '@/types/index.js';

/** Resolved target plus how it was identified. */
interface TargetUserResult {
  /** JID of the targeted user. */
  jid: string;
  /** True when the target came from a reply rather than an explicit mention. */
  fromQuoted: boolean;
}

/**
 * Resolves the user a moderation command targets.
 * An explicit mention wins over a quoted reply.
 *
 * @returns The target, or null when neither a mention nor a reply is present.
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

/** Builds the shared "you must mention or quote someone" error message. */
export function getErrorMessage(operation: string): string {
  return `❌ Debes mencionar un usuario o responder a su mensaje para ${operation}`;
}
