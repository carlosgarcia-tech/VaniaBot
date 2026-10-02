/**
 * AnimeLinkCommand.ts
 *
 * media command `animelink` — Enlaces de páginas de anime
 * Usage: !animelink
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

const ANIME_LINKS = [
  { name: 'Kusonime', url: 'https://kusonime.com' },
  { name: 'Hunter Sekai', url: 'https://huntersekaisub.blogspot.com' },
  { name: 'RIIE', url: 'https://riie.jp' },
  { name: 'Meownime', url: 'https://meownime.ltd' },
  { name: 'Nimegami', url: 'https://nimegami.id' },
  { name: 'Animekompi', url: 'https://animekompi.cam' },
  { name: 'Nonton Anime ID', url: 'https://nontonanimeid.top' },
  { name: 'Kazefuri', url: 'https://kazefuri.vip' },
  { name: 'Pendekar Subs', url: 'https://pendekarsubs.us' },
  { name: 'MyAnimeList', url: 'https://myanimelist.net' },
];

/** Command handler for `!animelink`: Enlaces de páginas de anime. */
export class AnimeLinkCommand extends Command {
  name = 'animelink';
  description = 'Enlaces de páginas de anime';
  category = CommandCategory.MEDIA;
  aliases = ['animelinks', 'animepage'];
  usage = '!animelink';
  examples = ['!animelink'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const linksText = ANIME_LINKS.map(link => `❖ ${link.name}: ${link.url}`).join('\n');

    await ctx.reply(
      `╭━━━〔 🎌 ENLACES DE ANIME 〕━━━⬣\n\n` + linksText + `\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`,
    );
  }
}
