import { Command } from '../../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PlayStoreCommand extends Command {
  name = 'playstore';
  description = 'Busca aplicaciones en Google Play Store';
  category = CommandCategory.ANIME;
  aliases = ['playstore'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!playstore <app>';
  examples = ['!playstore instagram'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !playstore <app>\n_Ejemplo: !playstore instagram');
      return;
    }

    await ctx.react('📱');
    try {
      const data = (await deliriusService.search('playstore', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[PlayStoreCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
