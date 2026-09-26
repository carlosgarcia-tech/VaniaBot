import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class PixivCommand extends NsfwMediaBase {
  name = 'pixiv';
  description = 'Busca en Pixiv';
  aliases = ['pixiv'];
  usage = '!pixiv <busqueda>';
  examples = ['!pixiv lisa'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🎨';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    return deliriusService.getAnimeImage(`pixiv?query=${encodeURIComponent(query)}`);
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }
}
