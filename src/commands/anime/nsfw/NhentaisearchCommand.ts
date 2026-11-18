/**
 * NhentaisearchCommand.ts
 *
 * OrbitBot commands module exposing `NhentaisearchCommand`.
 *
 * nhentai API v2 search (verified 18-nov-2026); blacklisted galleries are
 * skipped instead of shown.
 *
 * @author **Carlos G**
 */

import { nhentaiService } from '@/services/external/NhentaiService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class NhentaisearchCommand extends NsfwMediaBase {
  name = 'nhentaisearch';
  /** search + up to 3 gallery lookups (blacklist) on a slow link. */
  timeout = 90000;
  description = 'Busca un doujin en NHentai';
  aliases = ['nhentaisearch'];
  usage = '!nhentaisearch <busqueda>';
  examples = ['!nhentaisearch lisa'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔍';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    if (!query) {
      return null;
    }
    const gallery = await nhentaiService.search(query);
    return gallery?.coverUrl ?? null;
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }
}
