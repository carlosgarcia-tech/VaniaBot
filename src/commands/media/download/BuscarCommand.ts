/**
 * @fileoverview BuscarCommand.ts - Web search
 *
 * Performs web searches using DuckDuckGo.
 *
 * @module commands/media/download/BuscarCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { webSearchService } from '@/services/download/WebSearchService.js';
import { logError } from '@/utils/logger.js';

export class BuscarCommand extends Command {
  name = 'buscar';
  description = 'Busca en la web';
  category = CommandCategory.MEDIA;
  aliases = ['search', 'buscar', 'g'];
  usage = '!buscar <consulta>';
  examples = ['!buscar Node.js tutorial', '!search whatsapp bot'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Buscador Web* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!buscar <consulta>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!buscar Node.js tutorial\n` +
          `  ﹒!search javascript async await`,
      );
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Buscando: "${query}"...`);

    try {
      const result = await webSearchService.search(query);

      if (result._tag === 'Left') {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.left.message}`);
        return;
      }

      const text = webSearchService.formatResults(result.right, query);
      await ctx.reply(text);

      await ctx.react('✅');
    } catch (error) {
      logError('BuscarCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al realizar búsqueda');
    }
  }
}
