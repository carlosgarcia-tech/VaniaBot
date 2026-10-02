/**
 * CuevanaService.ts
 *
 * VaniaBot services module exposing `CuevanaService`, `CuevanaSearchResult`, `CuevanaSearchResponseInternal`, `CuevanaDetailInternal`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview CuevanaService.ts - Movie/Series search and download via dvyer-api
 *
 * Searches and downloads movies and series from Cuevana using the dvyer-api service.
 * Adapted from fsociety-bot without interactive buttons.
 *
 * @module services/download/CuevanaService
 */

import axios from 'axios';
import { logger } from '@/utils/logger.js';
import { left, right, type Either } from '@/utils/either.js';

const DVYER_API = 'https://dv-yer-api.online';
const DEFAULT_TIMEOUT = 30000;
const RESULT_LIMIT = 10;

export interface CuevanaSearchResult {
  title: string;
  original_title?: string;
  overview?: string;
  tmdb_id?: string;
  type: 'movie' | 'series';
  slug: string;
  poster?: string;
  url_slug?: string;
}

export interface CuevanaSearchResponseInternal {
  ok: boolean;
  mode: string;
  query?: string;
  count?: number;
  results?: CuevanaSearchResult[];
}

export interface CuevanaDetailInternal {
  ok: boolean;
  title: string;
  content_type?: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  downloads_all?: DownloadServer[];
  direct_url?: string;
  seasons?: Season[];
}

export interface DownloadServer {
  index?: number;
  server: string;
  language?: string;
  quality: string;
  url: string;
}

export interface Season {
  number: string | number;
  episodes?: Episode[];
}

export interface Episode {
  episode: string | number;
  title?: string;
  episode_path?: string;
}

export interface CuevanaDownloadResponseInternal {
  ok: boolean;
  download_url?: string;
  title?: string;
}

export type CuevanaError =
  | { code: 'NETWORK_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'API_ERROR'; message: string };

export type CuevanaSearchResultType = Either<CuevanaError, CuevanaSearchResult[]>;
export type CuevanaDetailResult = Either<CuevanaError, CuevanaDetailInternal>;
export type CuevanaDownloadResult = Either<CuevanaError, CuevanaDownloadResponseInternal>;

function clipText(value: string, max = 72): string {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 3))}...`;
}

export class CuevanaService {
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

  async search(query: string, limit = RESULT_LIMIT): Promise<CuevanaSearchResultType> {
    try {
      const url = `${DVYER_API}/cuevana?mode=search&q=${encodeURIComponent(query)}&limit=${limit}&type=auto`;
      const data = await this.fetchJson<CuevanaSearchResponseInternal>(url);
      if (data.ok && data.results) {
        return right(data.results);
      }
      return left({ code: 'NOT_FOUND', message: 'No se encontraron resultados' });
    } catch (error) {
      logger.error('CuevanaService.search error:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return left({ code: 'NETWORK_ERROR', message: `Error al buscar en Cuevana: ${message}` });
    }
  }

  async getDetail(slug: string, type = 'movie', lang = 'lat'): Promise<CuevanaDetailResult> {
    try {
      const url = `${DVYER_API}/cuevana?mode=detail&slug=${encodeURIComponent(slug)}&type=${type}&lang=${lang}&pick=fast`;
      const data = await this.fetchJson<CuevanaDetailInternal>(url);
      if (data.ok) {
        return right(data);
      }
      return left({ code: 'NOT_FOUND', message: 'No se pudo obtener el detalle' });
    } catch (error) {
      logger.error('CuevanaService.getDetail error:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return left({ code: 'NETWORK_ERROR', message: `Error al obtener detalle: ${message}` });
    }
  }

  async getDownload(url: string, lang = 'lat'): Promise<CuevanaDownloadResult> {
    try {
      const apiUrl = `${DVYER_API}/cuevana/download?url=${encodeURIComponent(url)}&lang=${lang}`;
      const data = await this.fetchJson<CuevanaDownloadResponseInternal>(
        apiUrl,
        DEFAULT_TIMEOUT * 2,
      );
      if (data.ok) {
        return right(data);
      }
      return left({ code: 'NOT_FOUND', message: 'No se pudo obtener el enlace de descarga' });
    } catch (error) {
      logger.error('CuevanaService.getDownload error:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return left({
        code: 'NETWORK_ERROR',
        message: `Error al obtener enlace de descarga: ${message}`,
      });
    }
  }

  formatSearchResults(results: CuevanaSearchResult[], query: string): string {
    if (!results || results.length === 0) {
      return `No se encontraron resultados para: *${query}*`;
    }

    let text = `🔍 *Resultados para:* ${query}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((item, index) => {
      const typeIcon = item.type === 'movie' ? '🎬' : '📺';
      const typeLabel = item.type === 'movie' ? 'Película' : 'Serie';
      text += `${typeIcon} *${index + 1}.* ${clipText(item.title, 60)}\n`;
      text += `   📌 ${typeLabel} | ${item.slug}\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `✦ Usa *!cv ${results[0].slug}* para ver opciones de descarga`;

    return text;
  }

  formatDetail(detail: CuevanaDetailInternal): { text: string; options: string[] } {
    const options: string[] = [];
    let text = '';

    if (detail.content_type === 'series') {
      text = `📺 *${detail.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `🎭 *Tipo:* Serie\n`;
      if (detail.overview) {
        text += `\n📝 ${clipText(detail.overview, 150)}\n`;
      }

      const seasons = detail.seasons || [];
      if (seasons.length > 0) {
        text += `\n📂 *Temporadas:* ${seasons.length}\n`;
        text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        for (const season of seasons) {
          const eps = season.episodes || [];
          if (eps.length > 0) {
            text += `📁 *Temporada ${season.number}* (${eps.length} episodios)\n`;
            options.push(
              `cvdl ${season.episodes?.[0]?.episode_path?.split('/').pop() || ''} episode`,
            );
            const epSample = eps
              .slice(0, 5)
              .map(
                (ep: Episode) =>
                  `   E${ep.episode}: ${clipText(ep.title || `Episodio ${ep.episode}`, 30)}`,
              )
              .join('\n');
            if (eps.length > 5) {
              text += epSample;
              text += `\n   ... y ${eps.length - 5} más\n`;
            } else {
              text += epSample;
            }
            text += '\n';
          }
        }
      }
    } else {
      text = `🎬 *${detail.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (detail.overview) {
        text += `\n📝 ${clipText(detail.overview, 200)}\n`;
      }

      const downloads = detail.downloads_all || [];
      if (downloads.length > 0) {
        text += `\n📥 *Servidores de descarga:*\n`;
        const servers = downloads
          .slice(0, 5)
          .map(
            (d: DownloadServer, i: number) =>
              `   ${i + 1}. ${d.server} (${d.quality}) [${d.language || 'LAT'}]`,
          )
          .join('\n');
        text += servers;
        if (downloads.length > 5) {
          text += `\n   ... y ${downloads.length - 5} más`;
        }
      }

      if (detail.direct_url) {
        options.push(`cvlink ${detail.direct_url}`);
        text += `\n\n⚡ *Descarga rápida disponible*`;
      }
    }

    return { text, options };
  }
}

export const cuevanaService = new CuevanaService();
