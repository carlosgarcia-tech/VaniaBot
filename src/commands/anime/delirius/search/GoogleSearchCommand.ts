/**
 * GoogleSearchCommand.ts
 *
 * anime command `google` — Busca en Google
 * Usage: !google <busqueda>
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

/** Command handler for `!google`: Busca en Google. */
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
      const data = (await deliriusService.search('googlesearch', { query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[GoogleSearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
