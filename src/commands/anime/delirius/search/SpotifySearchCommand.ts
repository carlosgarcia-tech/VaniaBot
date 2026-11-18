/**
 * SpotifySearchCommand.ts
 *
 * anime command `spotifysrc` — Searches songs by name
 * Usage: !spotifysrc <busqueda>
 *
 * Spotify's Web API stopped being free, so the search uses the iTunes Search
 * API (free, no key, verified alive 18-nov-2026). Use !spotify to download.
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { itunesService } from '@/services/external/ItunesService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!spotifysrc`: Searches songs by name. */
export class SpotifySearchCommand extends Command {
  name = 'spotifysrc';
  description = 'Busca canciones (iTunes)';
  category = CommandCategory.ANIME;
  aliases = ['spotifysrc'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!spotifysrc <busqueda>';
  examples = ['!spotifysrc despacito'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !spotifysrc <busqueda>\n_Ejemplo: !spotifysrc despacito');
      return;
    }

    await ctx.react('🎵');
    try {
      const track = await itunesService.searchSong(query);

      if (!track) {
        await ctx.react('❌');
        await ctx.reply('❌ No se encontraron resultados.');
        return;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: track.coverUrl },
        caption:
          `🎵 *${track.title}*\n` +
          `👤 ${track.artist}\n` +
          `💿 ${track.album}\n\n` +
          `_Descárgala con !spotify ${track.artist} ${track.title}_`,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[SpotifySearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
