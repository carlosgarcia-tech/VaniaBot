/**
 * TelegramStickerCommand.ts
 *
 * media command `telegramsticker` — Descarga sticker de Telegram
 * Usage: !telegramsticker <url>
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

/** Command handler for `!telegramsticker`: Descarga sticker de Telegram. */
export class TelegramStickerCommand extends Command {
  name = 'telegramsticker';
  description = 'Descarga sticker de Telegram';
  category = CommandCategory.MEDIA;
  aliases = ['tgsticker'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!telegramsticker <url>';
  examples = ['!telegramsticker https://t.me/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !telegramsticker <url>\n_Ejemplo: !telegramsticker https://t.me/...',
      );
      return;
    }

    await ctx.react('📥');

    try {
      const mediaUrl = await downloadService.getMediaUrl('telegramsticker', { url });
      await ctx.sock.sendMessage(ctx.chat.jid, {
        sticker: { url: mediaUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[TelegramStickerCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el sticker. Intenta de nuevo.');
    }
  }
}
