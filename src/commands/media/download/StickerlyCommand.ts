/**
 * StickerlyCommand.ts
 *
 * media command `stickerly` — Descarga stickers de Stickerly
 * Usage: !stickerly <url>
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

/** Command handler for `!stickerly`: Descarga stickers de Stickerly. */
export class StickerlyCommand extends Command {
  name = 'stickerly';
  description = 'Descarga stickers de Stickerly';
  category = CommandCategory.MEDIA;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!stickerly <url>';
  examples = ['!stickerly https://stickerly.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !stickerly <url>\n_Ejemplo: !stickerly https://stickerly.com/...');
      return;
    }

    await ctx.react('📥');

    try {
      const mediaUrl = await downloadService.getMediaUrl('stickerly', { url });
      await ctx.sock.sendMessage(ctx.chat.jid, {
        sticker: { url: mediaUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[StickerlyCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el sticker. Intenta de nuevo.');
    }
  }
}
