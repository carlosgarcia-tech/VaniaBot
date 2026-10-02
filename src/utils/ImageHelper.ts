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

export class ImageHelper {
  /**
   * Profile picture of the mentioned user, falling back to the sender's.
   * @returns Image URL, or null when neither has a picture.
   */
  static async getProfileImage(ctx: MessageContext): Promise<string | null> {
    const mentionedJid = ctx.mentionedJid;
    const targetJid = mentionedJid || ctx.sender.jid;

    try {
      const profileUrl = await ctx.sock.profilePictureUrl(targetJid, 'image');
      return profileUrl || null;
    } catch (error) {
      logError('[ImageHelper]', error);
      return null;
    }
  }

  /**
   * Profile pictures of the sender and the mentioned user, for two-avatar cards.
   *
   * When the mentioned user has no picture the sender's is reused, so
   * two-avatar commands still produce a complete image instead of a blank half.
   */
  static async getTwoProfileImages(ctx: MessageContext): Promise<[string | null, string | null]> {
    const mentionedJid = ctx.mentionedJid;

    let image1: string | null = null;
    let image2: string | null = null;

    try {
      const url1 = await ctx.sock.profilePictureUrl(ctx.sender.jid, 'image');
      image1 = url1 || null;
    } catch (error) {
      logError('[ImageHelper]', error);
      image1 = null;
    }

    if (mentionedJid) {
      try {
        const url2 = await ctx.sock.profilePictureUrl(mentionedJid, 'image');
        image2 = url2 || null;
      } catch (error) {
        logError('[ImageHelper]', error);
        image2 = null;
      }
    }

    if (!image2 && image1) {
      image2 = image1;
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
    try {
      const profileUrl = await ctx.sock.profilePictureUrl(targetJid, 'image');
      return profileUrl || null;
    } catch (error) {
      logError('[ImageHelper]', error);
      return null;
    }
  }
}
