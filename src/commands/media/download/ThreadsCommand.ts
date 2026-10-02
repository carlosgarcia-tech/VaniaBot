/**
 * ThreadsCommand.ts
 *
 * media command `threads` — Descarga contenido de Threads
 * Usage: !threads <url>
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

/** Command handler for `!threads`: Descarga contenido de Threads. */
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
      const data = (await downloadService.getJson('threads', { url })) as {
        result?: string;
        video?: string;
        image?: string;
      };

      const mediaUrl = data?.result || data?.video || data?.image;
      if (!mediaUrl) throw new Error('No media found');

      if (mediaUrl.endsWith('.mp4')) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: { url: mediaUrl },
        });
      } else {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: mediaUrl },
        });
      }
      await ctx.react('✅');
    } catch (error) {
      logError('[ThreadsCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el contenido. Intenta de nuevo.');
    }
  }
}
