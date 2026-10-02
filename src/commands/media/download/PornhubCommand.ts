/**
 * PornhubCommand.ts
 *
 * media command `pornhub` — Descarga video de Pornhub
 * Usage: !pornhub <url>
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

/** Command handler for `!pornhub`: Descarga video de Pornhub. */
export class PornhubCommand extends Command {
  name = 'pornhub';
  description = 'Descarga video de Pornhub';
  category = CommandCategory.MEDIA;
  aliases = ['ph'];
  cooldown = 20000;
  contexts = [CommandContext.BOTH];
  usage = '!pornhub <url>';
  examples = ['!pornhub https://pornhub.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !pornhub <url>\n_Ejemplo: !pornhub https://pornhub.com/...');
      return;
    }

    await ctx.react('🔞');

    try {
      const mediaUrl = await downloadService.getMediaUrl('pornhub', { url });
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: mediaUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[PornhubCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el video. Intenta de nuevo.');
    }
  }
}
