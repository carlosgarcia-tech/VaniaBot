/**
 * AnimeinfourlCommand.ts
 *
 * anime command `animeinfourl` — Shows anime information from a MAL/AniList URL
 * Usage: !animeinfourl <url>
 *
 * The numeric id in the URL is resolved through AniList (idMal for
 * myanimelist.net links, native id for anilist.co links).
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

/** Command handler for `!animeinfourl`: Shows anime information by URL. */
export class AnimeinfourlCommand extends Command {
  name = 'animeinfourl';
  /** AniList + cover on a slow link. */
  timeout = 60000;
  description = 'Muestra información de anime por URL';
  category = CommandCategory.ANIME;
  aliases = ['animeinfourl'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!animeinfourl <url>';
  examples = ['!animeinfourl https://myanimelist.net/anime/20/Naruto'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !animeinfourl <url>\n_Ejemplo: !animeinfourl https://myanimelist.net/anime/20/Naruto_',
      );
      return;
    }

    const match = url.match(/myanimelist\.net\/anime\/(\d+)/i);
    if (!match) {
      await ctx.reply('❌ Pásame un link de MyAnimeList (myanimelist.net/anime/<id>).');
      return;
    }

    await ctx.react('📺');
    try {
      const info = await animeInfoService.byMalId(Number(match[1]));
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
      logError('[AnimeinfourlCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener info del anime. Intenta de nuevo.');
    }
  }
}
