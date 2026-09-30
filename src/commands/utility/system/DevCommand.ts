import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

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

export class DevCommand extends Command {
  name = 'dev';
  description = 'Creador del bot';
  category = CommandCategory.UTILITY;
  aliases = ['creador', 'developer'];
  usage = '!dev';
  examples = ['!dev', '!creador'];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.react('👑');
    } catch (error) {
      logger.debug('[DevCommand] React failed:', error);
    }

    const devText =
      `⧼⋆꙳• *CREADOR* ⋆꙳•⧽\n\n` +
      `👑 ${toSmallCaps('nombre')}\n` +
      `   » Carlos G\n\n` +
      `💻 ${toSmallCaps('github')}\n` +
      `   » CARLOSGRCIAGRCIA\n\n` +
      `📷 ${toSmallCaps('instagram')}\n` +
      `   » carlos.gxv\n\n` +
      `🎵 ${toSmallCaps('tiktok')}\n` +
      `   » carlos.grcia0\n\n` +
      `🎥 ${toSmallCaps('youtube')}\n` +
      `   » carlos.dev01\n\n` +
      `📱 ${toSmallCaps('whatsapp')}\n` +
      `   » +52 951 652 6675\n\n` +
      `⧼⋆꙳• *ENLACES* ⋆꙳•⧽\n\n` +
      `💝 https://github.com/CARLOSGRCIAGRCIA\n\n` +
      `💝 https://www.instagram.com/carlos.gxv\n\n` +
      `💝 https://www.tiktok.com/@carlos.grcia0\n\n` +
      `💝 https://www.youtube.com/@carlos.dev01\n\n` +
      `⌬ 𝗩𝗔𝗡𝗜𝗔 𝗕𝗢𝗧 💝`;

    await ctx.sock.sendMessage(ctx.chat.jid, { text: devText }, { quoted: ctx.message });
  }
}

export default DevCommand;
