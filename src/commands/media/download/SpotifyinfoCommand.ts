/**
 * SpotifyinfoCommand.ts
 *
 * media command `spotifyinfo` — Obtiene información de una canción o artista de Spotify
 * Usage: !spotifyinfo <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!spotifyinfo`: Obtiene información de una canción o artista de Spotify. */
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
      const data = (await deliriusService.getJson('download', 'spotifyinfo', { url })) as {
        name?: string;
        artist?: string;
        album?: string;
        image?: string;
        duration?: string;
        release?: string;
        result?: string;
      };

      if (data?.result) {
        await ctx.reply(data.result);
      } else if (data?.name) {
        const info = `🎵 *${data.name}*\n👤 Artista: ${data.artist || 'Desconocido'}\n💿 Álbum: ${data.album || 'Desconocido'}\n⏱️ Duración: ${data.duration || 'N/A'}\n📅 Lanzamiento: ${data.release || 'N/A'}`;
        await ctx.reply(info);
      } else {
        await ctx.reply('❌ No pude obtener la información. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[SpotifyinfoCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al obtener información de Spotify. Intenta de nuevo.');
    }
  }
}
