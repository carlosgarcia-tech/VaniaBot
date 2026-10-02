/**
 * GimageCommand.ts
 *
 * anime command `gimage` — Busca imágenes en Google
 * Usage: !gimage <busqueda>
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

/** Command handler for `!gimage`: Busca imágenes en Google. */
export class GimageCommand extends Command {
  name = 'gimage';
  description = 'Busca imágenes en Google';
  category = CommandCategory.ANIME;
  aliases = ['gimage', 'gimg'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!gimage <busqueda>';
  examples = ['!gimage sunset'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !gimage <busqueda>\n_Ejemplo: !gimage sunset');
      return;
    }

    await ctx.react('🖼️');
    try {
      const data = (await deliriusService.search('gimage', { query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[GimageCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
