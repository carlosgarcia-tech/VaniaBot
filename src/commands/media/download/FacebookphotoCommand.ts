/**
 * FacebookphotoCommand.ts
 *
 * media command `facebookphoto` — Descarga fotos de Facebook
 * Usage: !facebookphoto <url>
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

/** Command handler for `!facebookphoto`: Descarga fotos de Facebook. */
export class FacebookphotoCommand extends Command {
  name = 'facebookphoto';
  description = 'Descarga fotos de Facebook';
  category = CommandCategory.MEDIA;
  aliases = ['fbphoto', 'fbpic'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  usage = '!facebookphoto <url>';
  examples = ['!facebookphoto https://www.facebook.com/photo/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !facebookphoto <url>\n_Ejemplo: !facebookphoto https://www.facebook.com/photo/..._',
      );
      return;
    }

    if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de Facebook');
      return;
    }

    await ctx.react('📸');
    await ctx.reply('📸 Descargando foto de Facebook...');

    try {
      const data = (await deliriusService.getJson('download', 'facebookphoto', { url })) as {
        image?: string;
        url?: string;
        result?: string;
      };

      const imageUrl = data?.image || data?.url || data?.result;

      if (imageUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: imageUrl },
          caption: '📸 Foto de Facebook',
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude descargar la foto. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[FacebookphotoCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Facebook. Intenta de nuevo.');
    }
  }
}
