/**
 * GeniusCommand.ts
 *
 * anime command `genius` — Busca letras de canciones en Genius
 * Usage: !genius <cancion>
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

/** Command handler for `!genius`: Busca letras de canciones en Genius. */
export class GeniusCommand extends Command {
  name = 'genius';
  description = 'Busca letras de canciones en Genius';
  category = CommandCategory.ANIME;
  aliases = ['genius', 'letras'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!genius <cancion>';
  examples = ['!genius despacito'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !genius <cancion>\n_Ejemplo: !genius despacito');
      return;
    }

    await ctx.react('🎤');
    try {
      const data = (await deliriusService.search('genius', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[GeniusCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
