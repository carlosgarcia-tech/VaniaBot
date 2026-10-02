/**
 * StickerRandomCommand.ts
 *
 * fun command `stickerrandom` — Genera un sticker meme aleatorio
 * Usage: !stickerrandom
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { logError } from '@/utils/logger.js';
import { MEDIA } from '@/utils/constants.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!stickerrandom`: Genera un sticker meme aleatorio. */
export class StickerRandomCommand extends Command {
  name = 'stickerrandom';
  description = 'Genera un sticker meme aleatorio';
  category = CommandCategory.FUN;
  aliases = ['stickerandom', 'randsticker', 'memesticker'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!stickerrandom';
  examples = ['!stickerrandom'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  private readonly MEME_IMAGES = [
    'https://i.imgflip.com/1bij.jpg',
    'https://i.imgflip.com/30b1gx.jpg',
    'https://i.imgflip.com/1g8my4.jpg',
    'https://i.imgflip.com/9ehk.jpg',
    'https://i.imgflip.com/26am.jpg',
    'https://i.imgflip.com/4t0m5.jpg',
    'https://i.imgflip.com/1otk96.jpg',
    'https://i.imgflip.com/1bhw.jpg',
    'https://i.imgflip.com/3lmzyx.jpg',
    'https://i.imgflip.com/2fm6x.jpg',
    'https://i.imgflip.com/1ur9b0.jpg',
    'https://i.imgflip.com/1bik.jpg',
    'https://i.imgflip.com/49z3c.jpg',
    'https://i.imgflip.com/1h5a3.jpg',
    'https://i.imgflip.com/3oevdk.jpg',
    'https://i.imgflip.com/2h1s1h.jpg',
    'https://i.imgflip.com/2a9u1e.jpg',
    'https://i.imgflip.com/1c1uej.jpg',
    'https://i.imgflip.com/9v2k7t.jpg',
    'https://i.imgflip.com/1yy0o.jpg',
    'https://i.imgflip.com/4a3x1q.jpg',
    'https://i.imgflip.com/5nm1.jpg',
    'https://i.imgflip.com/6rckg.jpg',
    'https://i.imgflip.com/7bw86.jpg',
    'https://i.imgflip.com/9ehk.jpg',
    'https://i.imgflip.com/3p3j9a.jpg',
    'https://i.imgflip.com/4t.jpg',
    'https://i.imgflip.com/xj43a.jpg',
    'https://i.imgflip.com/1ooa1h.jpg',
    'https://i.imgflip.com/7s7mu.jpg',
  ];

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎨');

    try {
      let imageUrl: string | null = null;

      try {
        const apiResponse = await fetch('https://api.imgflip.com/get_memes');
        if (apiResponse.ok) {
          const data = (await apiResponse.json()) as {
            success: boolean;
            data?: { memes: Array<{ url: string }> };
          };
          if (data.success && data.data?.memes) {
            const memes = data.data.memes;
            const randomMeme = memes[Math.floor(Math.random() * Math.min(memes.length, 100))];
            imageUrl = randomMeme?.url || null;
          }
        }
      } catch (error) {
        // La API de imgflip es opcional: hay lista local de memes de respaldo.
        logError('[StickerRandomCommand] imgflip API failed, using local memes', error);
      }

      if (!imageUrl) {
        imageUrl = this.MEME_IMAGES[Math.floor(Math.random() * this.MEME_IMAGES.length)];
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        await ctx.reply('No pude descargar la imagen. Intenta de nuevo.');
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { Jimp } = await import('jimp');
      const image = await Jimp.read(buffer);
      image.resize({ w: MEDIA.STICKER_SIZE, h: MEDIA.STICKER_SIZE });

      const finalBuffer = await image.getBuffer('image/png');

      const { Sticker, StickerTypes } = await import('wa-sticker-formatter');
      const sticker = new Sticker(finalBuffer, {
        pack: '🎲 Random Sticker',
        author: 'VaniaBot',
        type: StickerTypes.DEFAULT,
      });

      const stickerBuffer = await sticker.toBuffer();

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch (error) {
      logError('[StickerRandom] Failed to generate sticker', error);
      await ctx.reply('Ocurrió un error generando el sticker. Intenta de nuevo.');
    }
  }
}
