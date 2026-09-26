import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext } from '@/types/index.js';

export class TotalCharactersCommand extends NsfwMediaBase {
  name = 'totalcharacters';
  description = 'Muestra lista de personajes disponibles';
  aliases = ['tc', 'characters'];
  usage = '!totalcharacters';
  examples = ['!totalcharacters'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '📋';

  protected override requiresQuery(): boolean {
    return false;
  }

  protected override get usageEmoji(): string {
    return '📋';
  }

  protected async fetchMedia(): Promise<string | null> {
    return deliriusService.getAnimeImage('total_characters');
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }

  protected override errorMessage(): string {
    return '❌ No pude obtener la lista. Intenta de nuevo.';
  }
}
