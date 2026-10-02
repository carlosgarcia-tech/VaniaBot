/**
 * SpotifyalbumCommand.ts
 *
 * media command `spotifyalbum` — Descarga albums completos de Spotify
 * Usage: !spotifyalbum <url>
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

/** Command handler for `!spotifyalbum`: Descarga albums completos de Spotify. */
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
      const data = (await deliriusService.getJson('download', 'spotifyalbum', { url })) as {
        result?: string;
        download?: string;
        url?: string;
        tracks?: string[];
      };

      const downloadUrl = data?.result || data?.download || data?.url;

      if (downloadUrl) {
        await ctx.reply(`💿 *Album descargado*\n\n⬇️ Descarga: ${downloadUrl}`);
        await ctx.react('✅');
      } else if (data?.tracks?.length) {
        await ctx.reply(`💿 *Album encontrado*\n\n🎵 ${data.tracks.length} canciones`);
        for (const track of data.tracks.slice(0, 5)) {
          await ctx.reply(track);
        }
        if (data.tracks.length > 5) {
          await ctx.reply(`... y ${data.tracks.length - 5} más`);
        }
      } else {
        await ctx.reply('❌ No pude descargar el album. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[SpotifyalbumCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar album de Spotify. Intenta de nuevo.');
    }
  }
}
