/**
 * SpotifyplaylistCommand.ts
 *
 * media command `spotifyplaylist` — Descarga playlists completas de Spotify
 * Usage: !spotifyplaylist <url>
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

/** Command handler for `!spotifyplaylist`: Descarga playlists completas de Spotify. */
export class SpotifyplaylistCommand extends Command {
  name = 'spotifyplaylist';
  description = 'Descarga playlists completas de Spotify';
  category = CommandCategory.MEDIA;
  aliases = ['spplaylist', 'sp-list'];
  cooldown = 180000;
  contexts = [CommandContext.BOTH];
  usage = '!spotifyplaylist <url>';
  examples = ['!spotifyplaylist https://open.spotify.com/playlist/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !spotifyplaylist <url>\n_Ejemplo: !spotifyplaylist https://open.spotify.com/playlist/..._',
      );
      return;
    }

    if (!url.includes('spotify.com')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de Spotify');
      return;
    }

    await ctx.react('📋');
    await ctx.reply('📋 Buscando y descargando playlist de Spotify...');

    try {
      const data = (await deliriusService.getJson('download', 'spotifyplaylist', { url })) as {
        result?: string;
        download?: string;
        url?: string;
        tracks?: string[];
        name?: string;
      };

      const downloadUrl = data?.result || data?.download || data?.url;

      if (downloadUrl) {
        await ctx.reply(`📋 *Playlist descargada*\n\n⬇️ Descarga: ${downloadUrl}`);
        await ctx.react('✅');
      } else if (data?.tracks?.length) {
        const playlistName = data.name || 'Playlist';
        await ctx.reply(`📋 *${playlistName}*\n\n🎵 ${data.tracks.length} canciones`);
        for (const track of data.tracks.slice(0, 5)) {
          await ctx.reply(track);
        }
        if (data.tracks.length > 5) {
          await ctx.reply(`... y ${data.tracks.length - 5} más`);
        }
      } else {
        await ctx.reply('❌ No pude descargar la playlist. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[SpotifyplaylistCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar playlist de Spotify. Intenta de nuevo.');
    }
  }
}
