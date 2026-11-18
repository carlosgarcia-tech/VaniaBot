/**
 * PurrbotService.ts
 *
 * Client for Purrbot (api.purrbot.site/v2, verified alive 17-nov-2026) —
 * restores the NSFW reaction GIFs that died with Delirius. Categories are
 * path suffixes like `nsfw/fuck` or `sfw/neko`; responses are
 * `{ error: false, link: "<gif url>" }`.
 *
 * GIFs go through the shared GifToMp4 pipeline (download → ffmpeg → disk
 * cache) because WhatsApp cannot play raw GIFs.
 *
 * Content goes behind the `!nsfw on` toggle; no source with possible
 * underage content is wired here (doujin libraries and loli/shota stay out).
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { gifUrlToMp4 } from '@/services/media/GifToMp4.js';

const TIMEOUT_MS = 15000;
const BASE = 'https://api.purrbot.site/v2/img';
const USER_AGENT = 'OrbitBot/7.4 (WhatsApp bot)';

export class PurrbotService {
  /** Category path (`nsfw/fuck`, `sfw/neko`…) → mp4 Buffer for gifPlayback. */
  async getReactionVideo(category: string): Promise<Buffer> {
    const data = await this.fetchJson(category);
    if (data.error || !data.link) {
      throw new Error(`purrbot: no gif for '${category}'`);
    }
    return await gifUrlToMp4(data.link);
  }

  private async fetchJson(category: string): Promise<{ error: boolean; link?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE}/${category}/gif`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`purrbot error: ${response.status}`);
      }
      return (await response.json()) as { error: boolean; link?: string };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const purrbotService = new PurrbotService();
