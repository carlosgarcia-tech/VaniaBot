/**
 * PinterestCommand.ts
 *
 * media command `pinterest` — Descarga imágenes/videos de Pinterest
 * Usage: !pin <url de pinterest>
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview PinterestCommand.ts - Download from Pinterest
 *
 * Downloads images and videos from Pinterest.
 *
 * @module commands/media/download/PinterestCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { pinterestDownloader } from '@/services/download/PinterestDownloader.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!pinterest`: Descarga imágenes/videos de Pinterest. */
export class PinterestCommand extends Command {
  name = 'pinterest';
  description = 'Descarga imágenes/videos de Pinterest';
  category = CommandCategory.MEDIA;
  aliases = ['pin', 'pindl', 'pinterestdl'];
  usage = '!pin <url de pinterest>';
  examples = ['!pin https://pin.it/...'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args.join(' ').trim();

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Pinterest Downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!pin <url de pinterest>\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!pin https://pin.it/abc123`,
      );
      return;
    }

    const isPinterestUrl = url.includes('pinterest') || url.includes('pin.it');
    if (!isPinterestUrl) {
      await ctx.reply('❌ La URL debe ser de Pinterest (puede ser pin.it/...)');
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Obteniendo contenido de Pinterest...`);

    try {
      const result = await pinterestDownloader.getMedia(url);

      if (result._tag === 'Left') {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.left.message}`);
        return;
      }

      const media = result.right[0];

      if (media.type === 'image') {
        const dlResult = await pinterestDownloader.downloadImage(media.url);

        if (dlResult._tag === 'Right') {
          await ctx.sock.sendMessage(
            ctx.chat.jid,
            {
              image: { url: dlResult.right },
              caption: '📌 Pinterest',
            },
            { quoted: ctx.message },
          );
          pinterestDownloader.cleanup(dlResult.right);
          await ctx.react('✅');
        } else {
          await ctx.reply(`❌ ${dlResult.left.message}\n\n🔗 ${media.url}`);
        }
      } else {
        await ctx.reply(`📌 *Pinterest Video*\n\n🔗 ${media.url}`);
      }
    } catch (error) {
      logError('PinterestCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Pinterest');
    }
  }
}
