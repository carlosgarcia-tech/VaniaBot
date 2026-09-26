import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class NhentaisearchCommand extends NsfwMediaBase {
  name = 'nhentaisearch';
  description = 'Busca en NHentai';
  aliases = ['nhentaisearch'];
  usage = '!nhentaisearch <busqueda>';
  examples = ['!nhentaisearch lisa'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔍';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    return deliriusService.getAnimeImage(`nhentaiseARCH?query=${encodeURIComponent(query)}`);
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }
}
