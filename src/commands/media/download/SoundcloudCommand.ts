/**
 * SoundcloudCommand.ts
 *
 * media command `soundcloud` — Downloads SoundCloud audio
 * Usage: !soundcloud <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { ytDlpDownloader } from '@/services/download/YtDlpDownloader.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!soundcloud`: Downloads SoundCloud audio. */
export class SoundcloudCommand extends Command {
  name = 'soundcloud';
  /** Media downloads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  /** Independent network downloads: safe to run concurrently. */
  parallelizable = true;
  description = 'Descarga audio de SoundCloud';
  category = CommandCategory.MEDIA;
  aliases = ['scdl'];
  cooldown = 20000;
  contexts = [CommandContext.BOTH];
  usage = '!soundcloud <url>';
  examples = ['!soundcloud https://soundcloud.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !soundcloud <url>\n_Ejemplo: !soundcloud https://soundcloud.com/...',
      );
      return;
    }

    await ctx.react('🎵');

    try {
      const result = await ytDlpDownloader.downloadAudio(url);
      if (result._tag === 'Left') throw new Error(result.left.message);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        audio: { url: result.right.filePath },
        mimetype: 'audio/mpeg',
      });
      await ctx.react('✅');
      await ytDlpDownloader.cleanup(result.right.filePath);
    } catch (error) {
      logError('[SoundcloudCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el audio. Intenta de nuevo.');
    }
  }
}
