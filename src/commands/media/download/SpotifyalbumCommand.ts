/**
 * SpotifyalbumCommand.ts
 *
 * media command `spotifyalbum` — Downloads full Spotify albums
 * Usage: !spotifyalbum <url>
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

/** Command handler for `!spotifyalbum`: Downloads full Spotify albums. */
export class SpotifyalbumCommand extends Command {
  name = 'spotifyalbum';
  description = 'Descarga albums completos de Spotify';
  category = CommandCategory.MEDIA;
  aliases = ['spalbum', 'sp-album'];
  cooldown = 120000;
  contexts = [CommandContext.BOTH];
  usage = '!spotifyalbum <url>';
  examples = ['!spotifyalbum https://open.spotify.com/album/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !spotifyalbum <url>\n_Ejemplo: !spotifyalbum https://open.spotify.com/album/..._',
      );
      return;
    }

    if (!url.includes('spotify.com')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de Spotify');
      return;
    }

    await ctx.react('💿');
    await ctx.reply('💿 Buscando y descargando album de Spotify...');

    try {
      // Free path: the embed page exposes the full trackList (no API key).
      const tracks = await spotifyService.getTrackList(url);
      const list = tracks.map((t, i) => `${i + 1}. *${t.title}* — ${t.artist}`).join('\n');
      await ctx.reply(
        `💿 *Tracklist* (máx 20)\n\n${list}\n\n▶️ Descarga cada tema con !play <título>`,
      );
      await ctx.react('✅');
    } catch (error) {
      logError('[SpotifyalbumCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude leer la tracklist. Intenta de nuevo.');
    }
  }
}
