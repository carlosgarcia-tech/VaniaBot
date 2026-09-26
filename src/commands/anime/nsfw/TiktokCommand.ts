import { deliriusService } from '@/services/external/DeliriusService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext } from '@/types/index.js';

/**
 * Random NSFW TikTok-style video.
 *
 * Note: the `tiktok` command name belongs to media/download/TiktokCommand
 * (the URL downloader). This command is reachable via `tiktoknsfw` to avoid
 * the registry name collision that previously made `!tiktok <url>`
 * non-deterministically resolve to either command.
 */
export class TiktokCommand extends NsfwMediaBase {
  name = 'tiktoknsfw';
  description = 'Obtiene un video de TikTok aleatorio';
  aliases = ['tiktoknsfw'];
  usage = '!tiktoknsfw';
  examples = ['!tiktoknsfw'];
  contexts = [CommandContext.BOTH];

  protected override get usageEmoji(): string {
    return '🔞';
  }

  protected readonly searchEmoji = '🔞';

  protected override requiresQuery(): boolean {
    return false;
  }

  protected async fetchMedia(): Promise<string | null> {
    return deliriusService.getNsfwImage('tiktok');
  }

  protected buildMessage(mediaUrl: string): { video: { url: string } } {
    return { video: { url: mediaUrl } };
  }

  protected override errorMessage(): string {
    return '❌ No pude obtener el video. Intenta de nuevo.';
  }
}
