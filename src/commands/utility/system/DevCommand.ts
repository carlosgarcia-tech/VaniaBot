/**
 * DevCommand.ts
 *
 * utility command `dev` — Bot creator
 * Usage: !dev
 *
 * Sends the creator card (manga-style artwork) with the data drawn on top at
 * runtime. To change a username or phone, edit PROFILE below — nothing else.
 * If the image can't be generated, it falls back to the plain text version.
 *
 * Requires: `sharp`, `opentype.js` and the folder `assets/dev/`
 * (dev-base.png + fonts/) — see `@/utils/devCard.ts`.
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { logger, logError } from '@/utils/logger.js';
import { buildDevCard, devLinks, type DevProfile } from '@/utils/devCard.js';

/** ✏️ Edit your data here (bare usernames, no URLs and no "@"). */
const PROFILE: DevProfile = {
  name: 'Carlos G',
  role: 'Desarrollador',
  subtitle: 'Creador del bot',
  github: 'carlosgarcia-tech',
  instagram: 'carlos.gxv',
  tiktok: 'carlos.grcia0',
  youtube: 'carlos.dev01',
  whatsapp: '+52 951 652 6675',
};

const LINKS = devLinks(PROFILE);

const charset: Record<string, string> = {
  a: 'ᴀ',
  b: 'ʙ',
  c: 'ᴄ',
  d: 'ᴅ',
  e: 'ᴇ',
  f: 'ꜰ',
  g: 'ɢ',
  h: 'ʜ',
  i: 'ɪ',
  j: 'ᴊ',
  k: 'ᴋ',
  l: 'ʟ',
  m: 'ᴍ',
  n: 'ɴ',
  o: 'ᴏ',
  p: 'ᴘ',
  q: 'ǫ',
  r: 'ʀ',
  s: 'ꜱ',
  t: 'ᴛ',
  u: 'ᴜ',
  v: 'ᴠ',
  w: 'ᴡ',
  x: 'x',
  y: 'ʏ',
  z: 'ᴢ',
};

const toSmallCaps = (text: string): string =>
  text.toLowerCase().replace(/[a-z]/g, c => charset[c] || c);

/** Caption under the image: short, since the card already shows the details. */
const CAPTION =
  `⧼⋆꙳• *CREADOR* ⋆꙳•⧽\n\n` +
  `👑 *${PROFILE.name}*\n` +
  `_${PROFILE.subtitle}_\n\n` +
  `🪐 ${toSmallCaps('github')}\n${LINKS.github}\n\n` +
  `🪐 ${toSmallCaps('instagram')}\n${LINKS.instagram}\n\n` +
  `🪐 ${toSmallCaps('tiktok')}\n${LINKS.tiktok}\n\n` +
  `🪐 ${toSmallCaps('youtube')}\n${LINKS.youtube}\n\n` +
  `📱 ${toSmallCaps('whatsapp')}\n${LINKS.whatsapp}\n\n` +
  `⌬ 𝗢𝗥𝗕𝗜𝗧 𝗕𝗢𝗧 🪐`;

/** Text-only version, used if the image can't be generated. */
const FALLBACK_TEXT =
  `⧼⋆꙳• *CREADOR* ⋆꙳•⧽\n\n` +
  `👑 ${toSmallCaps('nombre')}\n   » ${PROFILE.name}\n\n` +
  `💻 ${toSmallCaps('github')}\n   » ${PROFILE.github}\n\n` +
  `📷 ${toSmallCaps('instagram')}\n   » ${PROFILE.instagram}\n\n` +
  `🎵 ${toSmallCaps('tiktok')}\n   » ${PROFILE.tiktok}\n\n` +
  `🎥 ${toSmallCaps('youtube')}\n   » ${PROFILE.youtube}\n\n` +
  `📱 ${toSmallCaps('whatsapp')}\n   » ${PROFILE.whatsapp}\n\n` +
  `⧼⋆꙳• *ENLACES* ⋆꙳•⧽\n\n` +
  `🪐 ${LINKS.github}\n` +
  `🪐 ${LINKS.instagram}\n` +
  `🪐 ${LINKS.tiktok}\n` +
  `🪐 ${LINKS.youtube}\n\n` +
  `⌬ 𝗢𝗥𝗕𝗜𝗧 𝗕𝗢𝗧 🪐`;

/** Command handler for `!dev`: Bot creator. */
export class DevCommand extends Command {
  name = 'dev';
  description = 'Creador del bot';
  category = CommandCategory.UTILITY;
  aliases = ['creador', 'developer'];
  usage = '!dev';
  examples = ['!dev', '!creador'];
  cooldown = 5000;

  /** The card only changes when PROFILE changes, so it is rendered once and reused. */
  private cardPromise: Promise<Buffer> | null = null;

  private getCard(): Promise<Buffer> {
    if (!this.cardPromise) {
      this.cardPromise = buildDevCard(PROFILE).catch(error => {
        this.cardPromise = null; // allow retry on the next call
        throw error;
      });
    }
    return this.cardPromise;
  }

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.react('👑');
    } catch (error) {
      logger.debug('[DevCommand] React failed:', error);
    }

    try {
      const image = await this.getCard();
      await ctx.sock.sendMessage(
        ctx.chat.jid,
        { image, caption: CAPTION },
        { quoted: ctx.message },
      );
    } catch (error) {
      logError('[DevCommand] Card failed, using text fallback', error);
      await ctx.sock.sendMessage(ctx.chat.jid, { text: FALLBACK_TEXT }, { quoted: ctx.message });
    }
  }
}

export default DevCommand;
