/**
 * WikiCommand.ts
 *
 * anime command `wiki` — Searches Wikipedia
 * Usage: !wiki <busqueda>
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

/** Command handler for `!wiki`: Searches Wikipedia. */
export class WikiCommand extends Command {
  name = 'wiki';
  description = 'Busca en Wikipedia';
  category = CommandCategory.ANIME;
  aliases = ['wiki', 'wikisrc'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!wiki <busqueda>';
  examples = ['!wiki anime'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !wiki <busqueda>\n_Ejemplo: !wiki anime');
      return;
    }

    await ctx.react('🔍');
    try {
      const r = await searchSourcesService.searchWiki(query);
      await ctx.reply(`📚 *${r.title}*\n\n${r.extract}${r.url ? `\n\n🔗 ${r.url}` : ''}`);
      await ctx.react('✅');
    } catch (error) {
      logError('[WikiCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No encontré el artículo. Prueba con otro término.');
    }
  }
}
