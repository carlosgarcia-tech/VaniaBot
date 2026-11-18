/**
 * NhentaiCommand.ts
 *
 * OrbitBot commands module exposing `NhentaiCommand`.
 *
 * nhentai API v2 is alive (verified 18-nov-2026). The gallery is rejected when
 * it carries a blacklisted underage tag.
 *
 * @author **Carlos G**
 */

import { nhentaiService } from '@/services/external/NhentaiService.js';
import { NsfwMediaBase } from './NsfwMediaBase.js';
import { CommandContext, type MessageContext } from '@/types/index.js';

export class NhentaiCommand extends NsfwMediaBase {
  name = 'nhentai';
  /** api + cover on a slow link. */
  timeout = 60000;
  description = 'Muestra un doujin de NHentai por código';
  aliases = ['nhentai'];
  usage = '!nhentai <código>';
  examples = ['!nhentai 123456'];
  contexts = [CommandContext.BOTH];

  protected readonly searchEmoji = '🔍';

  protected async fetchMedia(ctx: MessageContext): Promise<string | null> {
    const code = ctx.args?.[0]?.trim() ?? '';
    if (!/^\d+$/.test(code)) {
      return null;
    }
    const gallery = await nhentaiService.getGallery(code);
    return gallery.coverUrl;
  }

  protected buildMessage(mediaUrl: string): { image: { url: string } } {
    return { image: { url: mediaUrl } };
  }

  protected override usageMessage(): string {
    return '✍️ *Uso:* !nhentai <código> (solo números)\n_Ejemplo: !nhentai 123456_';
  }

  protected override errorMessage(): string {
    return '❌ No encontré ese doujin (o está bloqueado por seguridad).';
  }
}
