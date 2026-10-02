/**
 * TextMakerBase.ts
 *
 * VaniaBot commands module exposing `TextMakerBase`.
 *
 * @author **Carlos G**
 */

import * as mumaker from 'mumaker';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';

const BOT_CAPTION = 'VaniaBot';

export class TextMakerBase {
  async generateImage(pageUrl: string, text: string): Promise<string> {
    try {
      const result = await mumaker.ephoto(pageUrl, text);
      if (!result || !result.image) {
        throw new Error('No image URL received from the API');
      }
      return result.image;
    } catch (error) {
      logError('[TextMakerBase]', error);
      throw error;
    }
  }

  async sendImage(ctx: MessageContext, pageUrl: string, text: string): Promise<void> {
    const imageUrl = await this.generateImage(pageUrl, text);
    await ctx.sock.sendMessage(ctx.chat.jid, {
      image: { url: imageUrl },
      caption: BOT_CAPTION,
    });
  }
}
