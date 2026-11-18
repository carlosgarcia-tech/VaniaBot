/**
 * SnackvideoCommand.ts
 *
 * media command `snackvideo` — Downloads SnackVideo videos
 * Usage: !snackvideo <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { ytDlpDownloader } from '@/services/download/YtDlpDownloader.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!snackvideo`: Downloads SnackVideo videos. */
export class SnackvideoCommand extends Command {
  name = 'snackvideo';
  /** Media downloads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  /** Independent network downloads: safe to run concurrently. */
  parallelizable = true;
  description = 'Descarga videos de SnackVideo';
  category = CommandCategory.MEDIA;
  aliases = ['snack', 'snackv'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  usage = '!snackvideo <url>';
  examples = ['!snackvideo https://snackvideo.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !snackvideo <url>\n_Ejemplo: !snackvideo https://snackvideo.com/..._',
      );
      return;
    }

    await ctx.react('🎬');
    try {
      const result = await ytDlpDownloader.downloadVideo(url);
      if (result._tag === 'Left') throw new Error(result.left.message);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: result.right.filePath },
        mimetype: 'video/mp4',
      });
      await ctx.react('✅');
      await ytDlpDownloader.cleanup(result.right.filePath);
    } catch (error) {
      logError('[SnackvideoCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de SnackVideo. Intenta de nuevo.');
    }
  }
}
