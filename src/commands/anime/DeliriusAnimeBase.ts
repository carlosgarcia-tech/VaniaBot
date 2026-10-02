/**
 * DeliriusAnimeBase.ts
 *
 * VaniaBot commands module exposing `DeliriusAnimeBase`.
 *
 * @author **Carlos G**
 */

import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';

export class DeliriusAnimeBase {
  public async sendImage(ctx: MessageContext, endpoint: string): Promise<void> {
    try {
      const imageUrl = await deliriusService.getAnimeImage(endpoint);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[DeliriusAnime]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
