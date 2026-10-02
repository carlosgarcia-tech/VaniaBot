/**
 * TelegramStoriesCommand.ts
 *
 * media command `telegramstories` — Descarga stories de Telegram
 * Usage: !telegramstories <url>
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

/** Command handler for `!telegramstories`: Descarga stories de Telegram. */
export class TelegramStoriesCommand extends Command {
  name = 'telegramstories';
  description = 'Descarga stories de Telegram';
  category = CommandCategory.MEDIA;
  aliases = ['tgstories'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!telegramstories <url>';
  examples = ['!telegramstories https://t.me/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !telegramstories <url>\n_Ejemplo: !telegramstories https://t.me/...',
      );
      return;
    }

    await ctx.react('📥');

    try {
      const mediaUrl = await downloadService.getMediaUrl('telegramstories', { url });
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: mediaUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[TelegramStoriesCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el story. Intenta de nuevo.');
    }
  }
}
