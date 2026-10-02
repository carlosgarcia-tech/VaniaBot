/**
 * StickerWikiCommand.ts
 *
 * media command `stickerwiki` — Descarga stickers de StickerWiki
 * Usage: !stickerwiki <url>
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

/** Command handler for `!stickerwiki`: Descarga stickers de StickerWiki. */
export class StickerWikiCommand extends Command {
  name = 'stickerwiki';
  description = 'Descarga stickers de StickerWiki';
  category = CommandCategory.MEDIA;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!stickerwiki <url>';
  examples = ['!stickerwiki https://stickerwiki.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !stickerwiki <url>\n_Ejemplo: !stickerwiki https://stickerwiki.com/...',
      );
      return;
    }

    await ctx.react('📥');

    try {
      const mediaUrl = await downloadService.getMediaUrl('stickerwiki', { url });
      await ctx.sock.sendMessage(ctx.chat.jid, {
        sticker: { url: mediaUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[StickerWikiCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el sticker. Intenta de nuevo.');
    }
  }
}
