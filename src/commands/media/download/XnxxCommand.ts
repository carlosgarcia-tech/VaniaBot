/**
 * XnxxCommand.ts
 *
 * media command `xnxx` — Descarga video de XNXX
 * Usage: !xnxx <url>
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

/** Command handler for `!xnxx`: Descarga video de XNXX. */
export class XnxxCommand extends Command {
  name = 'xnxx';
  description = 'Descarga video de XNXX';
  category = CommandCategory.MEDIA;
  aliases = [];
  cooldown = 20000;
  contexts = [CommandContext.BOTH];
  usage = '!xnxx <url>';
  examples = ['!xnxx https://xnxx.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !xnxx <url>\n_Ejemplo: !xnxx https://xnxx.com/...');
      return;
    }

    await ctx.react('🔞');

    try {
      const mediaUrl = await downloadService.getMediaUrl('xnxxdl', { url });
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: mediaUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[XnxxCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el video. Intenta de nuevo.');
    }
  }
}
