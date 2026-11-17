/**
 * ImageHelper.ts
 *
 * Resolves which image a command should operate on.
 *
 * Commands that accept "an image" must handle several ways of supplying it:
 * a directly attached image, a quoted image, or no image at all (in which case a
 * profile picture stands in). These helpers centralise that precedence so every
 * command behaves the same way.
 *
 * All lookups return null instead of throwing, since a missing profile picture
 * is normal and should not fail the command.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

/** WhatsApp never answers picture queries for token-less users — bound the wait. */
const PROFILE_PIC_TIMEOUT_MS = 8_000;

export class ImageHelper {
  /**
   * WhatsApp refuses to answer picture queries for users it has no privacy
   * token for, and Baileys' profilePictureUrl has NO default timeout — it
   * hangs forever. Every lookup goes through here: bounded wait, null on any
   * failure, so a missing picture can never stall or crash a command.
   */
  static async safeProfilePicUrl(
    sock: MessageContext['sock'],
    jid: string,
  ): Promise<string | null> {
    try {
      // Race against our own timer: the third arg covers Baileys' protocol
      // timeouts, but only this race guarantees we bail out when the server
      // stays silent (no privacy token for that user).
      const url = await Promise.race([
        sock.profilePictureUrl(jid, 'image', PROFILE_PIC_TIMEOUT_MS),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`profile picture query timed out: ${jid}`)),
            PROFILE_PIC_TIMEOUT_MS,
          ),
        ),
      ]);
      return url || null;
    } catch (error) {
      logError('[ImageHelper]', error);
      return null;
    }
  }

  /**
   * Profile picture of the mentioned user, falling back to the sender's.
   * @returns Image URL, or null when neither has a picture.
   */
  static async getProfileImage(ctx: MessageContext): Promise<string | null> {
    const mentionedJid = ctx.mentionedJid;
    const targetJid = mentionedJid || ctx.sender.jid;
    return ImageHelper.safeProfilePicUrl(ctx.sock, targetJid);
  }

  /**
   * Profile pictures of the sender and the mentioned user, for two-avatar cards.
   *
   * When the mentioned user has no picture the sender's is reused, so
   * two-avatar commands still produce a complete image instead of a blank half.
   */
  static async getTwoProfileImages(ctx: MessageContext): Promise<[string | null, string | null]> {
    const mentionedJid = ctx.mentionedJid;

    const image1 = await ImageHelper.safeProfilePicUrl(ctx.sock, ctx.sender.jid);
    const image2 = mentionedJid
      ? await ImageHelper.safeProfilePicUrl(ctx.sock, mentionedJid)
      : null;

    if (!image2 && image1) {
      return [image1, image1];
    }

    return [image1, image2];
  }

  /**
   * Best available image, in precedence order:
   * attached image, quoted image, then the profile picture of the mentioned
   * user, the quoting user, or finally the sender.
   */
  static async getImageOrProfile(ctx: MessageContext): Promise<string | null> {
    const msg = ctx.message.message;
    const directImage = msg?.imageMessage;
    const quotedMsg = ctx.contextInfo?.quotedMessage;
    const quotedImage = quotedMsg?.imageMessage;
    const mentionedJid = ctx.mentionedJid;
    const quotedSender = ctx.contextInfo?.quotedMessage ? ctx.quotedParticipant : null;

    if (directImage?.url) {
      return directImage.url;
    }

    if (quotedImage?.url) {
      return quotedImage.url;
    }

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    return ImageHelper.safeProfilePicUrl(ctx.sock, targetJid);
  }
}
