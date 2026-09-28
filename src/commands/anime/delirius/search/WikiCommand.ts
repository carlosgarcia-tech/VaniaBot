import { Command } from '../../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

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
      const data = (await deliriusService.search('wiki', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[WikiCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
