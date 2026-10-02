/**
 * SnackvideoCommand.ts
 *
 * media command `snackvideo` — Descarga videos de SnackVideo
 * Usage: !snackvideo <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!snackvideo`: Descarga videos de SnackVideo. */
export class SnackvideoCommand extends Command {
  name = 'snackvideo';
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
      const data = (await deliriusService.getJson('download', 'snackvideo', { url })) as {
        video?: string;
        url?: string;
        download?: string;
        result?: string;
      };

      const videoUrl = data?.video || data?.url || data?.download || data?.result;

      if (videoUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: { url: videoUrl },
          caption: '🎬 Video de SnackVideo',
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude descargar el video. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[SnackvideoCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de SnackVideo. Intenta de nuevo.');
    }
  }
}
