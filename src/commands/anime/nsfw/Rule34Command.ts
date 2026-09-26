import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class Rule34Command extends NsfwMediaBase {
  name = 'rule34';
  description = 'Busca en Rule34';
  aliases = ['rule34'];
  usage = '!rule34 <busqueda>';
  examples = ['!rule34 anime'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔞';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const query = ctx.args?.join(' ').trim() ?? '';
    const data = (await deliriusService.search('rule34', { query })) as { result?: string };
    return data?.result ?? null;
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }

  protected override errorMessage(): string {
    return '❌ Error al buscar. Intenta de nuevo.';
  }
}
