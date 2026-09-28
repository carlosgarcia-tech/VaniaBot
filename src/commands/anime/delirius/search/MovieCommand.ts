import { Command } from '../../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class MovieCommand extends Command {
  name = 'movie';
  description = 'Busca información de películas';
  category = CommandCategory.ANIME;
  aliases = ['movies', 'peliculasrc'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!movie <pelicula>';
  examples = ['!movie Matrix'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !movie <pelicula>\n_Ejemplo: !movie Matrix');
      return;
    }

    await ctx.react('🎬');
    try {
      const data = (await deliriusService.search('movie', { query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[MovieCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
