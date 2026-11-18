/**
 * GiphyService.ts
 *
 * Giphy GIF API client (free key at developers.giphy.com) replacing Tenor,
 * whose Delirius glue died. Without GIPHY_API_KEY the service fails with a
 * clear message instead of a dead request.
 *
 * @author **Carlos G**
 * @created 2026-11-18
 */

const TIMEOUT_MS = 15000;
const BASE = 'https://api.giphy.com/v1/gifs/search';

export class GiphyService {
  /** First GIF url for a query (pg-13 keeps results safe for groups). */
  async searchGif(query: string): Promise<string> {
    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      throw new Error('GIPHY_API_KEY no configurada');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let data: { data?: Array<{ images?: { original?: { url?: string } } }> };
    try {
      const response = await fetch(
        `${BASE}?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&limit=1&rating=pg-13`,
        {
          headers: { 'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)', Accept: 'application/json' },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`giphy error: ${response.status}`);
      }
      data = (await response.json()) as typeof data;
    } finally {
      clearTimeout(timeoutId);
    }

    const url = data.data?.[0]?.images?.original?.url;
    if (!url) {
      throw new Error(`Sin resultados para '${query}'`);
    }
    return url;
  }
}

export const giphyService = new GiphyService();
