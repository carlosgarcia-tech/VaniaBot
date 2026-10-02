/**
 * SoundcloudCommand.ts
 *
 * media command `soundcloud` — Descarga audio de SoundCloud
 * Usage: !soundcloud <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { downloadService } from '@/services/external/DownloadService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!soundcloud`: Descarga audio de SoundCloud. */
export class SoundcloudCommand extends Command {
  name = 'soundcloud';
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
      const data = (await downloadService.getJson('soundcloud', { url })) as {
        result?: string;
        audio?: string;
      };

      const mediaUrl = data?.result || data?.audio;
      if (!mediaUrl) throw new Error('No audio found');

      await ctx.sock.sendMessage(ctx.chat.jid, {
        audio: { url: mediaUrl },
        mimetype: 'audio/mp4',
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[SoundcloudCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el audio. Intenta de nuevo.');
    }
  }
}
