/**
 * AnimeinfoCommand.ts
 *
 * anime command `animeinfo` — Shows anime information by title
 * Usage: !animeinfo <nombre>
 *
 * Data comes from AniList's public GraphQL API (free, no key).
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { animeInfoService, formatAnimeInfo } from '@/services/external/AnimeInfoService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!animeinfo`: Shows anime information by title. */
export class AnimeinfoCommand extends Command {
  name = 'animeinfo';
  /** AniList + cover on a slow link. */
  timeout = 60000;
  description = 'Muestra información de un anime';
  category = CommandCategory.ANIME;
  aliases = ['animeinfo'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!animeinfo <nombre>';
  examples = ['!animeinfo Naruto'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !animeinfo <nombre>\n_Ejemplo: !animeinfo Naruto_');
      return;
    }

    await ctx.react('📺');
    try {
      const info = await animeInfoService.search(query);
      if (!info) {
        await ctx.react('❌');
        await ctx.reply('❌ No encontré ese anime.');
        return;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: info.coverUrl },
        caption: formatAnimeInfo(info),
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[AnimeinfoCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener info del anime. Intenta de nuevo.');
    }
  }
}
