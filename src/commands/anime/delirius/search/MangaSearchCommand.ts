/**
 * MangaSearchCommand.ts
 *
 * anime command `mangasearch` — Busca manga
 * Usage: !mangasearch <manga>
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

/** Command handler for `!mangasearch`: Busca manga. */
export class MangaSearchCommand extends Command {
  name = 'mangasearch';
  description = 'Busca manga';
  category = CommandCategory.ANIME;
  aliases = ['mangasearch', 'buscamanga'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!mangasearch <manga>';
  examples = ['!mangasearch One Piece'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !mangasearch <manga>\n_Ejemplo: !mangasearch One Piece');
      return;
    }

    await ctx.react('📚');
    try {
      const data = (await deliriusService.search('mangasearch', { q: query })) as {
        result?: string;
      };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[MangaSearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
