/**
 * Facebookv2Command.ts
 *
 * media command `facebookv2` — Downloads Facebook videos (v2)
 * Usage: !facebookv2 <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { FacebookDownloader } from '@/services/download/FacebookDownloader.js';
import { isRight } from '@/utils/either.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!facebookv2`: Downloads Facebook videos (v2). */
export class Facebookv2Command extends Command {
  name = 'facebookv2';
  /** Media downloads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  /** Independent network downloads: safe to run concurrently. */
  parallelizable = true;
  description = 'Descarga videos de Facebook (v2)';
  category = CommandCategory.MEDIA;
  aliases = ['fbv2', 'fbvideo2'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  usage = '!facebookv2 <url>';
  examples = ['!facebookv2 https://www.facebook.com/watch/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !facebookv2 <url>\n_Ejemplo: !facebookv2 https://www.facebook.com/watch/..._',
      );
      return;
    }

    if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de Facebook');
      return;
    }

    await ctx.react('📹');
    await ctx.reply('📹 Descargando video de Facebook...');

    try {
      // Same yt-dlp pipeline as !facebook (the v2 API died with Delirius).
      const downloader = new FacebookDownloader();
      const result = await downloader.downloadVideo(url);
      if (!isRight(result)) throw new Error(result.left.message);

      const filePath = result.right.filePath;
      try {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: { url: filePath },
          mimetype: 'video/mp4',
        });
        await ctx.react('✅');
      } finally {
        await downloader.cleanup(filePath);
      }
    } catch (error) {
      logError('[Facebookv2Command]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Facebook. Intenta de nuevo.');
    }
  }
}
