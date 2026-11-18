/**
 * NekobotService.ts
 *
 * Client for nekobot.xyz (verified alive 17-nov-2026) — restores the NSFW
 * anime-image commands that died with Delirius/Prince. Responses are
 * `{ success: true, message: "<url>" }`. Public types only: the "donator"
 * token types and real-person types (gonewild, pgif) are not wired.
 *
 * Content goes behind the `!nsfw` toggle.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

const TIMEOUT_MS = 15000;
const BASE = 'https://nekobot.xyz/api/image';
const USER_AGENT = 'OrbitBot/7.4 (WhatsApp bot)';

export class NekobotService {
  /** Image type (`hneko`, `hkitsune`, `boobs`, `hentai`…) → image URL. */
  async getImage(type: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE}?type=${encodeURIComponent(type)}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`nekobot error: ${response.status}`);
      }
      const data = (await response.json()) as { success?: boolean; message?: string };
      if (!data.success || !data.message) {
        throw new Error(`nekobot: no image for '${type}'`);
      }
      return data.message;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const nekobotService = new NekobotService();
