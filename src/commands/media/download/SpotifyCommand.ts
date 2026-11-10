/**
 * SpotifyCommand.ts
 *
 * media command `spotify` — Downloads music from Spotify
 * Usage: !spotify <url>
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

/** Command handler for `!spotify`: Downloads music from Spotify. */
export class SpotifyCommand extends Command {
  name = 'spotify';
  /** Media downloads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  /** Independent network downloads: safe to run concurrently. */
  parallelizable = true;
  description = 'Descarga música de Spotify';
  category = CommandCategory.MEDIA;
  aliases = ['sp', 'spotdl', 'spotifydl'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  usage = '!spotify <url>';
  examples = ['!spotify https://open.spotify.com/track/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !spotify <url>\n_Ejemplo: !spotify https://open.spotify.com/track/..._',
      );
      return;
    }

    if (!url.includes('spotify.com')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de Spotify');
      return;
    }

    await ctx.react('🎵');
    await ctx.reply('🎵 Buscando y descargando de Spotify...');

    try {
      const data = (await deliriusService.getJson('download', 'spotifydl', { url })) as {
        result?: string;
        audio?: string;
        download?: string;
      };

      const downloadUrl = data?.result || data?.audio || data?.download;

      if (downloadUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          audio: { url: downloadUrl },
          mimetype: 'audio/mpeg',
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude descargar el audio. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[SpotifyCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Spotify. Intenta de nuevo.');
    }
  }
}
