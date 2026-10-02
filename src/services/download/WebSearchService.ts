/**
 * WebSearchService.ts
 *
 * VaniaBot services module exposing `WebSearchService`, `SearchResult`, `webSearchService`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview WebSearchService.ts - Web search using DuckDuckGo
 *
 * Provides web search functionality using DuckDuckGo Lite.
 *
 * @module services/download/WebSearchService
 */

import axios from 'axios';
import { logger } from '@/utils/logger.js';
import { left, right, type Either } from '@/utils/either.js';

const _DUCKDUCKGO_LITE = 'https://lite.duckduckgo.com/lite/';
const DEFAULT_LIMIT = 10;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type WebSearchError =
  { code: 'NETWORK_ERROR'; message: string } | { code: 'NO_RESULTS'; message: string };

export type WebSearchResult = Either<WebSearchError, SearchResult[]>;

function escapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export class WebSearchService {
  async search(query: string, limit = DEFAULT_LIMIT): Promise<WebSearchResult> {
    try {
      const response = await axios.get(`https://html.duckduckgo.com/html/`, {
        params: { q: query, kl: 'es-mx' },
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
      });

      const results: SearchResult[] = [];
      const html = response.data;

      const resultRegex =
        /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;

      while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
        const url = match[1];
        const title = escapeHtml(match[2].trim());
        const snippet = escapeHtml(match[3].replace(/<[^>]+>/g, '').trim());

        if (url && title && !url.includes('duckduckgo') && url.startsWith('http')) {
          results.push({ title, url, snippet: snippet.slice(0, 200) });
        }
      }

      if (results.length === 0) {
        const simpleRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        while ((match = simpleRegex.exec(html)) !== null && results.length < limit) {
          const url = match[1];
          const title = escapeHtml(match[2].trim());
          if (
            url &&
            title &&
            !url.includes('duckduckgo') &&
            !url.includes('yandex') &&
            url.startsWith('http')
          ) {
            results.push({ title, url, snippet: '' });
          }
        }
      }

      if (results.length === 0) {
        return left({ code: 'NO_RESULTS', message: 'No se encontraron resultados para: ' + query });
      }

      return right(results);
    } catch (error) {
      logger.error('WebSearchService.search error:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return left({ code: 'NETWORK_ERROR', message: `Error al realizar búsqueda: ${message}` });
    }
  }

  formatResults(results: SearchResult[], query: string): string {
    if (!results || results.length === 0) {
      return `No se encontraron resultados para: *${query}*`;
    }

    let text = `🔍 *Resultados para:* ${query}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((result, index) => {
      text += `📌 *${index + 1}.* ${result.title}\n`;
      if (result.snippet) {
        text += `   ${result.snippet.slice(0, 100)}${result.snippet.length > 100 ? '...' : ''}\n`;
      }
      text += `   🔗 ${result.url.slice(0, 60)}${result.url.length > 60 ? '...' : ''}\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `✦ *${results.length}* resultados encontrados`;

    return text;
  }
}

export const webSearchService = new WebSearchService();
