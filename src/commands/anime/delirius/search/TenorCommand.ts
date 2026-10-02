/**
 * TenorCommand.ts
 *
 * anime command `tenor` — Busca GIFs en Tenor
 * Usage: !tenor <busqueda>
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

/** Command handler for `!tenor`: Busca GIFs en Tenor. */
export class TenorCommand extends Command {
  name = 'tenor';
  description = 'Busca GIFs en Tenor';
  category = CommandCategory.ANIME;
  aliases = ['tenor', 'gif'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!tenor <busqueda>';
  examples = ['!tenor happy'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !tenor <busqueda>\n_Ejemplo: !tenor happy');
      return;
    }

    await ctx.react('🎬');
    try {
      const data = (await deliriusService.search('tenor', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[TenorCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
