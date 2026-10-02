/**
 * AnimeinfoCommand.ts
 *
 * anime command `animeinfo` — Muestra información de un anime
 * Usage: !animeinfo <nombre>
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

/** Command handler for `!animeinfo`: Muestra información de un anime. */
export class AnimeinfoCommand extends Command {
  name = 'animeinfo';
  description = 'Muestra información de un anime';
  category = CommandCategory.ANIME;
  aliases = ['animeinfo'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!animeinfo <nombre>';
  examples = ['!animeinfo Naruto', '!animeinfo Death Note'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !animeinfo <nombre>\n_Ejemplo: !animeinfo Naruto_');
      return;
    }

    await ctx.react('📺');
    try {
      const imageUrl = await deliriusService.getAnimeImage(
        `animeinfo?query=${encodeURIComponent(query)}`,
      );
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[AnimeinfoCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener info del anime. Intenta de nuevo.');
    }
  }
}
