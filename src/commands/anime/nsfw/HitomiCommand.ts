import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class HitomiCommand extends NsfwMediaBase {
  name = 'hitomi';
  description = 'Busca en Hitomi con URL';
  aliases = ['hitomi'];
  usage = '!hitomi <url>';
  examples = ['!hitomi https://hitomi.la/...'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔍';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const url = ctx.args?.join(' ').trim() ?? '';

    if (!url.startsWith('http')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de hitomi.la');
      return null;
    }

    return deliriusService.getAnimeImage(`hitomi?url=${encodeURIComponent(url)}`);
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }

  protected override errorMessage(): string {
    return '❌ No pude buscar en Hitomi. Intenta de nuevo.';
  }
}
