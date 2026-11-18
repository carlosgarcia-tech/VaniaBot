/**
 * GoogleSearchCommand.ts
 *
 * anime command `google` — Searches Google
 * Usage: !google <busqueda>
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { webSearchService } from '@/services/download/WebSearchService.js';
import { isRight } from '@/utils/either.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!google`: Searches Google. */
export class GoogleSearchCommand extends Command {
  name = 'google';
  description = 'Busca en Google';
  category = CommandCategory.ANIME;
  aliases = ['google', 'gsearch'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!google <busqueda>';
  examples = ['!google tecnologia'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !google <busqueda>\n_Ejemplo: !google tecnologia');
      return;
    }

    await ctx.react('🔍');
    try {
      const results = await webSearchService.search(query, 5);
      if (!isRight(results) || !results.right.length) {
        await ctx.reply('❌ No se encontraron resultados.');
        return;
      }
      const text = results.right
        .map((r, i) => `${i + 1}. *${r.title}*\n${r.snippet}\n🔗 ${r.url}`)
        .join('\n\n');
      await ctx.reply(`🔎 *Google: ${query}*\n\n${text}`);
      await ctx.react('✅');
    } catch (error) {
      logError('[GoogleSearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
