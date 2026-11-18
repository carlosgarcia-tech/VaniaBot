/**
 * Rule34Command.ts
 *
 * OrbitBot commands module exposing `Rule34Command`.
 *
 * api.rule34.xxx now requires authentication, so explicit images come from
 * Danbooru (rating:e, verified alive 18-nov-2026). BooruService filters every
 * post through the shared underage-tag blacklist.
 *
 * @author **Carlos G**
 */

import { booruService } from '@/services/external/BooruService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class Rule34Command extends NsfwMediaBase {
  name = 'rule34';
  /** danbooru query on a slow link. */
  timeout = 60000;
  description = 'Busca imágenes explícitas (Danbooru)';
  aliases = ['rule34'];
  usage = '!rule34 <busqueda>';
  examples = ['!rule34 anime'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔞';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    // Anonymous Danbooru allows 2 tags: the user tag plus the rating.
    const tags = `${query} rating:e`.trim();
    try {
      return await booruService.randomPost('danbooru', tags);
    } catch (error) {
      // rule34 tag names differ from Danbooru's ("anime"/"hentai" do not
      // exist there), so an empty result falls back to any explicit post.
      if (query && error instanceof Error && error.message.startsWith('Sin resultados')) {
        return await booruService.randomPost('danbooru', 'rating:e');
      }
      throw error;
    }
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }

  protected override errorMessage(): string {
    return '❌ No encontré resultados (o fueron filtrados por seguridad).';
  }
}
