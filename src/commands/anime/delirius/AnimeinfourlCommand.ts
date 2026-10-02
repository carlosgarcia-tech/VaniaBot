/**
 * AnimeinfourlCommand.ts
 *
 * anime command `animeinfourl` — Muestra información de anime por URL
 * Usage: !animeinfourl <url>
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

/** Command handler for `!animeinfourl`: Muestra información de anime por URL. */
export class AnimeinfourlCommand extends Command {
  name = 'animeinfourl';
  description = 'Muestra información de anime por URL';
  category = CommandCategory.ANIME;
  aliases = ['animeinfourl'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!animeinfourl <url>';
  examples = ['!animeinfourl https://myanimelist.net/anime/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !animeinfourl <url>\n_Ejemplo: !animeinfourl https://myanimelist.net/anime/..._',
      );
      return;
    }

    if (!url.startsWith('http')) {
      await ctx.reply('❌ Debes proporcionar una URL válida');
      return;
    }

    await ctx.react('📺');
    try {
      const imageUrl = await deliriusService.getAnimeImage(
        `animeinfourl?url=${encodeURIComponent(url)}`,
      );
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[AnimeinfourlCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener info del anime. Intenta de nuevo.');
    }
  }
}
