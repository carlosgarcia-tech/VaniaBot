/**
 * PinterestCommand.ts
 *
 * anime command `pinterestsrc` — Busca imágenes en Pinterest
 * Usage: !pinterest <busqueda>
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

/** Command handler for `!pinterestsrc`: Busca imágenes en Pinterest. */
export class PinterestCommand extends Command {
  name = 'pinterestsrc';
  description = 'Busca imágenes en Pinterest';
  category = CommandCategory.ANIME;
  aliases = ['pinterestsrc'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!pinterest <busqueda>';
  examples = ['!pinterest gatos'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !pinterestsrc <busqueda>\n_Ejemplo: !pinterestsrc gatos');
      return;
    }

    await ctx.react('📌');
    try {
      const data = (await deliriusService.search('pinterest', { text: query })) as {
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
      logError('[PinterestCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
