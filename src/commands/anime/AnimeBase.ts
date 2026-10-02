/**
 * AnimeBase.ts
 *
 * VaniaBot commands module exposing `AnimeBase`.
 *
 * @author **Carlos G**
 */

import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const TIMEOUT_MS = 30000;

export class AnimeBase {
  protected readonly API_BASE = 'https://api.princetechn.com/api/anime';
  protected readonly API_KEY = process.env.ANIME_API_KEY || 'prince';

  protected async fetchImage(endpoint: string): Promise<Buffer> {
    const url = `${this.API_BASE}/${endpoint}?apikey=${this.API_KEY}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API_ERROR:${response.status}`);
      }

      const data = (await response.json()) as { result?: string; error?: string };

      if (data.error) {
        throw new Error(`API_ERROR:${data.error}`);
      }

      if (!data.result || typeof data.result !== 'string') {
        throw new Error('Invalid API response: missing image URL');
      }

      const imageUrl = data.result;
      const imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'image/*',
        },
        signal: controller.signal,
      });

      if (!imageResponse.ok) {
        throw new Error(`IMAGE_ERROR:${imageResponse.status}`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!buffer || buffer.length === 0) {
        throw new Error('Empty image response');
      }

      if (buffer.length > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max 5MB)`);
      }

      return buffer;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async sendImage(ctx: MessageContext, endpoint: string, caption?: string): Promise<void> {
    try {
      const buffer = await this.fetchImage(endpoint);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: buffer,
        caption: caption || undefined,
      });
      await ctx.react('✅');
    } catch (error) {
      await this.handleError(ctx, error);
    }
  }

  public async handleError(ctx: MessageContext, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('[AnimeBase]', error);

    if (errorMessage.includes('404') || errorMessage.includes('IMAGE_ERROR:404')) {
      await ctx.reply('❌ Imagen no encontrada. Intenta de nuevo.');
    } else if (errorMessage.includes('429')) {
      await ctx.reply('❌ Límite de solicitudes excedido. Intenta más tarde.');
    } else if (errorMessage.includes('ECONNABORTED') || errorMessage.includes('timeout')) {
      await ctx.reply('❌ Tiempo de espera agotado. Intenta de nuevo.');
    } else if (errorMessage.includes('too large')) {
      await ctx.reply('❌ La imagen es muy grande. Intenta con otra.');
    } else {
      await ctx.reply(`❌ Error al obtener la imagen: ${errorMessage.replace(/.*Error:/, '')}`);
    }

    await ctx.react('❌');
  }
}
