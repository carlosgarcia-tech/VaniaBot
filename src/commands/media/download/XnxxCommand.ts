/**
 * XnxxCommand.ts
 *
 * media command `xnxx` — Downloads XNXX video
 * Usage: !xnxx <url>
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

/** Command handler for `!xnxx`: Downloads XNXX video. */
export class XnxxCommand extends Command {
  name = 'xnxx';
  /** Adult content: gated by the !nsfw toggle in the pipeline. */
  nsfw = true;
  /** Media downloads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  parallelizable = true;
  description = 'Descarga video de XNXX';
  category = CommandCategory.MEDIA;
  aliases = [];
  cooldown = 20000;
  contexts = [CommandContext.BOTH];
  usage = '!xnxx <url>';
  examples = ['!xnxx https://xnxx.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !xnxx <url>\n_Ejemplo: !xnxx https://xnxx.com/...');
      return;
    }

    await ctx.react('🔞');

    try {
      const result = await ytDlpDownloader.downloadVideo(url);
      if (result._tag === 'Left') throw new Error(result.left.message);

      const filePath = result.right.filePath;
      try {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: { url: filePath },
          mimetype: 'video/mp4',
        });
        await ctx.react('✅');
      } finally {
        await ytDlpDownloader.cleanup(filePath);
      }
    } catch (error) {
      logError('[XnxxCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude descargar el video. Intenta de nuevo.');
    }
  }
}
