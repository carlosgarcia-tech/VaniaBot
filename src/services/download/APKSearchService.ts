/**
 * APKSearchService.ts
 *
 * VaniaBot services module exposing `APKSearchService`, `APKApp`, `APKSearchResponseInternal`, `apkSearchService`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview APKSearchService.ts - Search Android apps via dvyer-api
 *
 * Searches for Android applications using the dvyer-api service.
 *
 * @module services/download/APKSearchService
 */

import axios from 'axios';
import { logger } from '@/utils/logger.js';
import { left, right, type Either } from '@/utils/either.js';

const DVYER_API = 'https://dv-yer-api.online';
const DEFAULT_TIMEOUT = 30000;

export interface APKApp {
  name: string;
  package?: string;
  developer?: string;
  version?: string;
  size?: string;
  icon?: string;
  download?: string;
}

export interface APKSearchResponseInternal {
  ok: boolean;
  count?: number;
  results?: APKApp[];
}

export type APKError =
  { code: 'NETWORK_ERROR'; message: string } | { code: 'NOT_FOUND'; message: string };

export type APKSearchResult = Either<APKError, APKApp[]>;

export class APKSearchService {
  private async fetchJson<T>(url: string, timeout = DEFAULT_TIMEOUT): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await axios.get<T>(url, {
        signal: controller.signal,
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      return response.data;
    } finally {
      clearTimeout(timer);
    }
  }

  async search(query: string, limit = 5, lang = 'es'): Promise<APKSearchResult> {
    try {
      const url = `${DVYER_API}/apksearch?q=${encodeURIComponent(query)}&limit=${limit}&lang=${lang}`;
      const data = await this.fetchJson<APKSearchResponseInternal>(url);
      if (data.ok && data.results) {
        return right(data.results);
      }
      return left({ code: 'NOT_FOUND', message: 'No se encontraron aplicaciones' });
    } catch (error) {
      logger.error('APKSearchService.search error:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return left({ code: 'NETWORK_ERROR', message: `Error al buscar APK: ${message}` });
    }
  }

  formatResults(results: APKApp[], query: string): string {
    if (!results || results.length === 0) {
      return `No se encontraron apps para: *${query}*\n\n_Usa: !apk <nombre de app>_`;
    }

    let text = `📱 *Resultados APK para:* ${query}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((app, index) => {
      const appName = app.name || 'Aplicación sin nombre';
      text += `📦 *${index + 1}.* ${appName}\n`;
      if (app.developer) text += `   👤 ${app.developer}\n`;
      if (app.version) text += `   📌 Versión: ${app.version}\n`;
      if (app.size) text += `   💾 Tamaño: ${app.size}\n`;
      text += '\n';
    });

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `✦ Usa *!apkdl <nombre>* para descargar`;

    return text;
  }
}

export const apkSearchService = new APKSearchService();
