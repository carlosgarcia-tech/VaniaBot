/**
 * MangaSearchCommand.ts
 *
 * anime command `mangasearch` — Searches manga
 * Usage: !mangasearch <manga>
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

/** Command handler for `!mangasearch`: Searches manga. */
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
      const m = await searchSourcesService.searchManga(query);
      if (!m) {
        await ctx.reply('❌ No encontré ese manga en MangaDex.');
        return;
      }
      const caption = `📖 *${m.title}*${m.year ? ` (${m.year})` : ''}\n🔗 manga.dex`;
      if (m.coverUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: m.coverUrl }, caption });
      } else {
        await ctx.reply(caption);
      }
      await ctx.react('✅');
    } catch (error) {
      logError('[MangaSearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
