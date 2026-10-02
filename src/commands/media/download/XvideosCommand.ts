/**
 * XvideosCommand.ts
 *
 * media command `xvideos` — Descarga video de XVideos
 * Usage: !xvideos <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { downloadService } from '@/services/external/DownloadService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!xvideos`: Descarga video de XVideos. */
export class XvideosCommand extends Command {
  name = 'xvideos';
  description = 'Descarga video de XVideos';
  category = CommandCategory.MEDIA;
  aliases = [];
  cooldown = 20000;
  contexts = [CommandContext.BOTH];
  usage = '!xvideos <url>';
  examples = ['!xvideos https://xvideos.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !xvideos <url>\n_Ejemplo: !xvideos https://xvideos.com/...');
      return;
    }

    await ctx.react('🔞');

    try {
      const mediaUrl = await downloadService.getMediaUrl('xvideos', { url });
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: mediaUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[XvideosCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el video. Intenta de nuevo.');
    }
  }
}
