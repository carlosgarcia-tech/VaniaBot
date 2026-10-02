/**
 * Facebookv2Command.ts
 *
 * media command `facebookv2` — Descarga videos de Facebook (v2)
 * Usage: !facebookv2 <url>
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

/** Command handler for `!facebookv2`: Descarga videos de Facebook (v2). */
export class Facebookv2Command extends Command {
  name = 'facebookv2';
  description = 'Descarga videos de Facebook (v2)';
  category = CommandCategory.MEDIA;
  aliases = ['fbv2', 'fbvideo2'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  usage = '!facebookv2 <url>';
  examples = ['!facebookv2 https://www.facebook.com/watch/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !facebookv2 <url>\n_Ejemplo: !facebookv2 https://www.facebook.com/watch/..._',
      );
      return;
    }

    if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de Facebook');
      return;
    }

    await ctx.react('📹');
    await ctx.reply('📹 Descargando video de Facebook...');

    try {
      const data = (await deliriusService.getJson('download', 'facebookv2', { url })) as {
        video?: string;
        url?: string;
        download?: string;
        result?: string;
      };

      const videoUrl = data?.video || data?.url || data?.download || data?.result;

      if (videoUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: { url: videoUrl },
          caption: '📹 Video de Facebook',
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude descargar el video. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[Facebookv2Command]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Facebook. Intenta de nuevo.');
    }
  }
}
