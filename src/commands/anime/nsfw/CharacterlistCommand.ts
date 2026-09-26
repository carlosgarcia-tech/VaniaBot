import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class CharacterlistCommand extends NsfwMediaBase {
  name = 'characterlist';
  description = 'Busca un personaje de anime';
  aliases = ['character', 'chars'];
  usage = '!characterlist <nombre>';
  examples = ['!characterlist Naruto', '!characterlist One Piece'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔍';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    return deliriusService.getAnimeImage(`characterlist?query=${encodeURIComponent(query)}`);
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }

  protected override errorMessage(): string {
    return '❌ No pude buscar el personaje. Intenta de nuevo.';
  }
}
