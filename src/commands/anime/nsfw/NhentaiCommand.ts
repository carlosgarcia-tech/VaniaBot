import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class NhentaiCommand extends NsfwMediaBase {
  name = 'nhentai';
  description = 'Busca un hentai en NHentai';
  aliases = ['nhentai'];
  usage = '!nhentai <codigo>';
  examples = ['!nhentai 123456'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔍';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    const data = (await deliriusService.getJson('anime', 'nhentai', { query })) as {
      result?: string;
    };
    return data?.result ?? null;
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }

  protected override errorMessage(): string {
    return '❌ Error al buscar. Intenta de nuevo.';
  }
}
