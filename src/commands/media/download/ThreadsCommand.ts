/**
 * ThreadsCommand.ts
 *
 * media command `threads` — Downloads Threads content
 * Usage: !threads <url>
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

/** Command handler for `!threads`: Downloads Threads content. */
export class ThreadsCommand extends Command {
  name = 'threads';
  description = 'Descarga contenido de Threads';
  category = CommandCategory.MEDIA;
  aliases = ['thread'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!threads <url>';
  examples = ['!threads https://www.threads.net/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !threads <url>\n_Ejemplo: !threads https://www.threads.net/...');
      return;
    }

    await ctx.react('📥');

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
      logError('[ThreadsCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el contenido. Intenta de nuevo.');
    }
  }
}
