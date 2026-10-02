/**
 * DeliriusService.ts
 *
 * VaniaBot services module exposing `DeliriusService`, `deliriusService`.
 *
 * @author **Carlos G**
 */

type DeliriusCategory =
  'anime' | 'nsfw' | 'canvas' | 'download' | 'random' | 'reactions' | 'search' | 'ia';

const TIMEOUT_MS = 30000;

const CATEGORY_URLS: Record<DeliriusCategory, string> = {
  anime: 'https://api.delirius.store/anime',
  nsfw: 'https://api.delirius.store/nsfw',
  canvas: 'https://api.delirius.store/canvas',
  download: 'https://api.delirius.store',
  random: 'https://api.delirius.store/random',
  reactions: 'https://api.delirius.store/reactions',
  search: 'https://api.delirius.store/search',
  ia: 'https://api.delirius.store/ia',
};

export class DeliriusService {
  async getImage(category: DeliriusCategory, endpoint: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${CATEGORY_URLS[category]}/${endpoint}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Delirius Error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('image')) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        return `data:${contentType};base64,${base64}`;
      }

      const data = (await response.json()) as {
        status?: boolean;
        result?: string;
        image?: string;
        url?: string;
        data?: { url?: string; image?: string; result?: string };
      };

      if (data.data?.url) return data.data.url;
      if (data.data?.image) return data.data.image;
      if (data.data?.result) return data.data.result;
      if (data.result) return data.result;
      if (data.image) return data.image;
      if (data.url) return data.url;

      throw new Error('No image URL in response');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getJson(
    category: DeliriusCategory,
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      let url = `${CATEGORY_URLS[category]}/${endpoint}`;
      if (params) {
        const searchParams = new URLSearchParams(params);
        url += `?${searchParams.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Delirius Error: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getNsfwImage(endpoint: string): Promise<string> {
    return this.getImage('nsfw', endpoint);
  }

  async getAnimeImage(endpoint: string): Promise<string> {
    return this.getImage('anime', endpoint);
  }

  async getRandomImage(endpoint: string): Promise<string> {
    return this.getImage('random', endpoint);
  }

  async getReactionsImage(endpoint: string): Promise<string> {
    return this.getImage('reactions', endpoint);
  }

  async search(query: string, params?: Record<string, string>): Promise<unknown> {
    return this.getJson('search', query, params);
  }

  async getIa(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    return this.getJson('ia', endpoint, params);
  }
}

export const deliriusService = new DeliriusService();
