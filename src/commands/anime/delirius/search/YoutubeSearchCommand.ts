/**
 * YoutubeSearchCommand.ts
 *
 * anime command `ytsearch` — Busca videos en YouTube
 * Usage: !ytsearch <busqueda>
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

/** Command handler for `!ytsearch`: Busca videos en YouTube. */
export class YoutubeSearchCommand extends Command {
  name = 'ytsearch';
  description = 'Busca videos en YouTube';
  category = CommandCategory.ANIME;
  aliases = ['ytsearch', 'yts'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!ytsearch <busqueda>';
  examples = ['!ytsearch música'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !ytsearch <busqueda>\n_Ejemplo: !ytsearch música');
      return;
    }

    await ctx.react('🔍');
    try {
      const data = (await deliriusService.search('ytsearch', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[YoutubeSearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
