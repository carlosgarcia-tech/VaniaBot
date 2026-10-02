/**
 * DownloadService.ts
 *
 * VaniaBot services module exposing `DownloadService`, `downloadService`.
 *
 * @author **Carlos G**
 */

const BASE_URL = 'https://api.delirius.store/download';
const TIMEOUT_MS = 60000;

export class DownloadService {
  async getJson(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      let url = `${BASE_URL}/${endpoint}`;
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
        throw new Error(`Download Error: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getMediaUrl(endpoint: string, params?: Record<string, string>): Promise<string> {
    const data = (await this.getJson(endpoint, params)) as Record<string, unknown>;

    if (data.result) return data.result as string;
    if (data.url) return data.url as string;
    if (data.download) return data.download as string;
    if (data.link) return data.link as string;
    if (data.file_url) return data.file_url as string;

    throw new Error('No URL in response');
  }
}

export const downloadService = new DownloadService();
