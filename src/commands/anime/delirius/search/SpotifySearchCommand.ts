/**
 * SpotifySearchCommand.ts
 *
 * anime command `spotifysrc` — Busca canciones en Spotify
 * Usage: !spotify <busqueda>
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!spotifysrc`: Busca canciones en Spotify. */
export class SpotifySearchCommand extends Command {
  name = 'spotifysrc';
  description = 'Busca canciones en Spotify';
  category = CommandCategory.ANIME;
  aliases = ['spotifysrc'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!spotify <busqueda>';
  examples = ['!spotify despacito'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !spotifysrc <busqueda>\n_Ejemplo: !spotifysrc despacito');
      return;
    }

    await ctx.react('🎵');
    try {
      const data = (await deliriusService.search('spotify', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[SpotifySearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
