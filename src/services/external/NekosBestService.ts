/**
 * NekosBestService.ts
 *
 * Client for nekos.best — the replacement for the dead Delirius reactions
 * and Prince Techn animebase endpoints (verified alive 17-nov-2026).
 *
 * The API serves reaction GIFs as .gif files; WhatsApp only plays video
 * messages with gifPlayback, so GIF categories are downloaded and converted
 * to mp4 once (ffmpeg), then cached on disk by their unique id.
 *
 * The docs require a well-formed User-Agent on every request.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { gifUrlToMp4 } from '@/services/media/GifToMp4.js';

const TIMEOUT_MS = 20000;
const USER_AGENT = 'OrbitBot/7.3 (WhatsApp bot; nekos.best client)';

export class NekosBestService {
  private readonly BASE = 'https://nekos.best/api/v2';
  private readonly TEMP_DIR = './data/temp';

  /** Image URL for an image category (neko, waifu, kitsune, husbando…). */
  async getImageUrl(category: string): Promise<string> {
    const data = await this.fetchJson(category);
    const url = data.results?.[0]?.url;
    if (!url) throw new Error(`nekos.best: no url for '${category}'`);
    return url;
  }

  /**
   * GIF category → mp4 Buffer, ready for `gifPlayback` sending. The shared
   * GifToMp4 helper downloads, converts and disk-caches by unique gif name.
   */
  async getReactionVideo(category: string): Promise<Buffer> {
    const url = await this.getImageUrl(category);
    return await gifUrlToMp4(url);
  }

  private async fetchJson(category: string): Promise<{ results?: Array<{ url?: string }> }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.BASE}/${category}?amount=1`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`nekos.best error: ${response.status}`);
      }
      return (await response.json()) as { results?: Array<{ url?: string }> };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const nekosBestService = new NekosBestService();
