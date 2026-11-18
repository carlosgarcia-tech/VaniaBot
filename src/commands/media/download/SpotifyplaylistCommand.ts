/**
 * SpotifyplaylistCommand.ts
 *
 * media command `spotifyplaylist` — Downloads full Spotify playlists
 * Usage: !spotifyplaylist <url>
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

/** Command handler for `!spotifyplaylist`: Downloads full Spotify playlists. */
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
      // Free path: the embed page exposes the full trackList (no API key).
      const tracks = await spotifyService.getTrackList(url);
      const list = tracks.map((t, i) => `${i + 1}. *${t.title}* — ${t.artist}`).join('\n');
      await ctx.reply(
        `💿 *Tracklist* (máx 20)\n\n${list}\n\n▶️ Descarga cada tema con !play <título>`,
      );
      await ctx.react('✅');
    } catch (error) {
      logError('[SpotifyplaylistCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude leer la tracklist. Intenta de nuevo.');
    }
  }
}
