/**
 * TenorCommand.ts
 *
 * anime command `tenor` — Searches GIFs on Giphy
 * Usage: !tenor <busqueda>
 *
 * Tenor's old Delirius glue is dead; Giphy's public API replaces it. The gif
 * is transcoded to mp4 so WhatsApp can play it with gifPlayback. Needs a free
 * GIPHY_API_KEY registered at developers.giphy.com.
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { giphyService } from '@/services/external/GiphyService.js';
import { gifUrlToMp4 } from '@/services/media/GifToMp4.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!tenor`: Searches GIFs on Giphy. */
export class TenorCommand extends Command {
  name = 'tenor';
  /** gif download + ffmpeg transcode on a slow link. */
  timeout = 120000;
  description = 'Busca GIFs en Giphy';
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

    if (!process.env.GIPHY_API_KEY) {
      await ctx.reply(
        '⚠️ Este comando necesita *GIPHY_API_KEY* configurada (gratis en developers.giphy.com).',
      );
      return;
    }

    await ctx.react('🎬');
    try {
      const gifUrl = await giphyService.searchGif(query);
      const video = await gifUrlToMp4(gifUrl);
      await ctx.sock.sendMessage(ctx.chat.jid, { video, gifPlayback: true });
      await ctx.react('✅');
    } catch (error) {
      logError('[TenorCommand]', error);
      await ctx.react('❌');
      await ctx.reply(
        error instanceof Error && error.message.includes('Sin resultados')
          ? '❌ No se encontraron resultados.'
          : '❌ Error al buscar. Intenta de nuevo.',
      );
    }
  }
}
