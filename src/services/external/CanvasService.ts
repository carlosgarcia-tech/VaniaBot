/**
 * CanvasService.ts
 *
 * VaniaBot services module exposing `CanvasService`, `canvasService`.
 *
 * @author **Carlos G**
 */

import { logError } from '@/utils/logger.js';

const BASE_URL = 'https://api.delirius.store/canvas';
const TIMEOUT_MS = 30000;

export type CanvasResult =
  { type: 'url'; url: string } | { type: 'buffer'; buffer: Buffer; contentType: string };

export class CanvasService {
  async getResult(endpoint: string, params?: Record<string, string>): Promise<CanvasResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      let url = `${BASE_URL}/${endpoint}`;
      if (params) {
        url += `?${new URLSearchParams(params).toString()}`;
      }

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        throw new Error(`Canvas Error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (
        contentType.includes('image') ||
        contentType.includes('video') ||
        contentType.includes('webm') ||
        contentType.includes('gif')
      ) {
        return { type: 'buffer', buffer, contentType };
      }

      try {
        const text = buffer.toString('utf-8');
        const data = JSON.parse(text) as { result?: string; image?: string; url?: string };
        const imageUrl = data.result ?? data.image ?? data.url;
        if (imageUrl) return { type: 'url', url: imageUrl };
      } catch (error) {
        logError('[CanvasService]', error);
        return { type: 'buffer', buffer, contentType: contentType || 'application/octet-stream' };
      }

      throw new Error('No image URL in response');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getImage(endpoint: string, params?: Record<string, string>): Promise<string> {
    const result = await this.getResult(endpoint, params);

    if (result.type === 'url') return result.url;

    if (result.contentType.includes('image') && !result.contentType.includes('gif')) {
      return `data:${result.contentType};base64,${result.buffer.toString('base64')}`;
    }

    throw new Error(`Binary response (${result.contentType}) — use getResult() instead`);
  }
}

export const canvasService = new CanvasService();
