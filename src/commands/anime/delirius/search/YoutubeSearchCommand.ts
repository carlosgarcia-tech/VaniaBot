/**
 * YoutubeSearchCommand.ts
 *
 * anime command `ytsearch` — Searches videos on YouTube
 * Usage: !ytsearch <busqueda>
 *
 * Search runs through yt-dlp (ytsearch1, already required by !ytmp3/!ytmp4);
 * the old Delirius glue is dead.
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { searchVideo } from '@/services/download/YouTubeSearchService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!ytsearch`: Searches videos on YouTube. */
export class YoutubeSearchCommand extends Command {
  name = 'ytsearch';
  /** yt-dlp search can take a while on a slow link. */
  timeout = 90000;
  description = 'Busca videos en YouTube';
  category = CommandCategory.ANIME;
  aliases = ['ytsearch', 'yts'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!ytsearch <busqueda>';
  examples = ['!ytsearch música'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !ytsearch <busqueda>\n_Ejemplo: !ytsearch música');
      return;
    }

    await ctx.react('🔍');
    try {
      const video = await searchVideo(query);

      if (!video) {
        await ctx.react('❌');
        await ctx.reply('❌ No se encontraron resultados.');
        return;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: video.thumbnail },
        caption: `🎬 *${video.title}*\n⏱️ ${video.duration}\n🔗 ${video.url}`,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[YoutubeSearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
