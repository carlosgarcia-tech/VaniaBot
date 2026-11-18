/**
 * GimageCommand.ts
 *
 * anime command `gimage` — Searches images on Google
 * Usage: !gimage <busqueda>
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { imageService } from '@/services/external/ImageService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!gimage`: Searches images on Google. */
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
      const results = await imageService.searchImages(query, 3);
      const first = results.find(r => r.url);
      if (!first) {
        await ctx.reply('❌ No se encontraron imágenes.');
        return;
      }
      await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: first.url } });
      await ctx.react('✅');
    } catch (error) {
      logError('[GimageCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
