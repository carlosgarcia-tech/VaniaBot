/**
 * MovieCommand.ts
 *
 * anime command `movie` — Searches movie information
 * Usage: !movie <pelicula>
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { searchSourcesService } from '@/services/external/SearchSourcesService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!movie`: Searches movie information. */
export class MovieCommand extends Command {
  name = 'movie';
  description = 'Busca información de películas';
  category = CommandCategory.ANIME;
  aliases = ['movies', 'peliculasrc'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!movie <pelicula>';
  examples = ['!movie Matrix'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !movie <pelicula>\n_Ejemplo: !movie Matrix');
      return;
    }

    await ctx.react('🎬');
    try {
      const m = await searchSourcesService.searchMovie(query);
      if (!m) {
        await ctx.reply(
          '❌ No encontré esa película (¿TMDB_API_KEY está configurada en el servidor?)',
        );
        return;
      }
      const caption = `🎬 *${m.title}*${m.year ? ` (${m.year})` : ''}${m.rating ? `\n⭐ ${m.rating.toFixed(1)}/10` : ''}${m.overview ? `\n\n${m.overview.slice(0, 300)}` : ''}`;
      if (m.posterUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: m.posterUrl }, caption });
      } else {
        await ctx.reply(caption);
      }
      await ctx.react('✅');
    } catch (error) {
      logError('[MovieCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
