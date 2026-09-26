import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class HentaitvCommand extends NsfwMediaBase {
  name = 'hentaitv';
  description = 'Busca en HentaiTV';
  aliases = ['hentaitv'];
  usage = '!hentaitv <busqueda>';
  examples = ['!hentaitv lisa'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔍';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    return deliriusService.getAnimeImage(`hentaitv?query=${encodeURIComponent(query)}`);
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }
}
