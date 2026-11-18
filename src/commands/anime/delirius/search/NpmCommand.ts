/**
 * NpmCommand.ts
 *
 * anime command `npm` — Searches packages on NPM
 * Usage: !npm <paquete>
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

/** Command handler for `!npm`: Searches packages on NPM. */
export class NpmCommand extends Command {
  name = 'npm';
  description = 'Busca paquetes en NPM';
  category = CommandCategory.ANIME;
  aliases = ['npm', 'npmsearch'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!npm <paquete>';
  examples = ['!npm express'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !npm <paquete>\n_Ejemplo: !npm express');
      return;
    }

    await ctx.react('📦');
    try {
      const list = await searchSourcesService.searchNpm(query);
      if (!list.length) {
        await ctx.reply('❌ No se encontraron paquetes.');
        return;
      }
      const text = list
        .map((p, i) => `${i + 1}. *${p.name}@${p.version}*\n   ${p.description}`)
        .join('\n\n');
      await ctx.reply(`📦 *npm: ${query}*\n\n${text}`);
      await ctx.react('✅');
    } catch (error) {
      logError('[NpmCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
