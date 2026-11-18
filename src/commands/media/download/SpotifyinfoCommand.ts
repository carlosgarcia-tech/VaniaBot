/**
 * SpotifyinfoCommand.ts
 *
 * media command `spotifyinfo` — Gets information about a Spotify song or artist
 * Usage: !spotifyinfo <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { spotifyService } from '@/services/external/SpotifyService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!spotifyinfo`: Gets information about a Spotify song or artist. */
export class SpotifyinfoCommand extends Command {
  name = 'spotifyinfo';
  description = 'Obtiene información de una canción o artista de Spotify';
  category = CommandCategory.MEDIA;
  aliases = ['spinfo', 'spotify-info'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!spotifyinfo <url>';
  examples = ['!spotifyinfo https://open.spotify.com/track/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !spotifyinfo <url>\n_Ejemplo: !spotifyinfo https://open.spotify.com/track/..._',
      );
      return;
    }

    if (!url.includes('spotify.com')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de Spotify');
      return;
    }

    await ctx.react('🎵');
    await ctx.reply('🎵 Obteniendo información de Spotify...');

    try {
      const info = await spotifyService.getTrackInfo(url);
      const caption = `🎵 *${info.title}*\n\n▶️ Descarga el audio con !spotify ${url}`;
      if (info.thumbnailUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: info.thumbnailUrl }, caption });
      } else {
        await ctx.reply(caption);
      }
      await ctx.react('✅');
    } catch (error) {
      logError('[SpotifyinfoCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la información. Intenta de nuevo.');
    }
  }
}
