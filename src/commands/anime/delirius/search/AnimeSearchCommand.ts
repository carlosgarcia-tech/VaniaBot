/**
 * AnimeSearchCommand.ts
 *
 * anime command `animesearch` — Busca anime en AniList
 * Usage: !animesearch <anime>
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

/** Command handler for `!animesearch`: Busca anime en AniList. */
export class AnimeSearchCommand extends Command {
  name = 'animesearch';
  description = 'Busca anime en AniList';
  category = CommandCategory.ANIME;
  aliases = ['animesearch', 'buscanime'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!animesearch <anime>';
  examples = ['!animesearch Naruto'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !animesearch <anime>\n_Ejemplo: !animesearch Naruto');
      return;
    }

    await ctx.react('🔍');
    try {
      const data = (await deliriusService.search('anilist', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[AnimeSearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
