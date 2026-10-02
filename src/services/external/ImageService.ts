/**
 * ImageService.ts
 *
 * VaniaBot services module exposing `ImageService`, `imageService`.
 *
 * @author **Carlos G**
 */

import axios, { type AxiosResponse } from 'axios';
import { logger } from '@/utils/logger.js';
import { env } from '@/config/env.js';

interface ImageResult {
  id: number | string;
  url: string;
  photographer: string;
  alt: string;
  width: number;
  height: number;
}

interface PexelsPhoto {
  id: number;
  src: {
    large?: string;
    medium?: string;
    original?: string;
  };
  photographer: string;
  alt: string;
  width: number;
  height: number;
}

interface PexelsResponse {
  photos: PexelsPhoto[];
}

interface PixabayHit {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  user: string;
  webformatWidth: number;
  webformatHeight: number;
}

interface PixabayResponse {
  hits: PixabayHit[];
}

interface AxiosWithResponseUrl extends AxiosResponse {
  request?: {
    res?: {
      responseUrl?: string;
    };
  };
}

/**
 * ImageService — búsqueda de imágenes sin APIs de pago.
 *
 * Cadena de fallback (orden de prioridad):
 *   1. Pixabay         — si PIXABAY_API_KEY está definida (gratis, 500 req/hora)
 *   2. Pexels          — si PEXELS_API_KEY está definida (gratis, 200 req/hora)
 *   3. Unsplash Source — sin key, URL directa (deprecated pero aún funciona)
 *   4. Lorem Picsum    — imágenes placeholder si todo lo demás falla
 */
export class ImageService {
  private static instance: ImageService;

  private readonly PEXELS_API = 'https://api.pexels.com/v1/search';
  private readonly PIXABAY_API = 'https://pixabay.com/api/';

  private cache = new Map<string, { results: ImageResult[]; ts: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  async searchImages(query: string, perPage = 5): Promise<ImageResult[]> {
    const cacheKey = `${query}:${perPage}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
      logger.debug('[ImageService] Usando caché para:', query);
      return cached.results;
    }

    let results: ImageResult[] = [];

    if (env.PIXABAY_API_KEY) {
      try {
        logger.info(`[ImageService] 🔍 Buscando en Pixabay: "${query}" (${perPage} resultados)`);
        results = await this.searchPixabay(query, perPage);
        if (results.length) {
          logger.info(
            `[ImageService] ✅ Pixabay devolvió ${results.length} resultados para: ${query}`,
          );
        }
      } catch (err) {
        logger.warn('[ImageService] Pixabay falló:', err);
      }
    }

    if (!results.length && env.PEXELS_API_KEY) {
      try {
        logger.info(`[ImageService] 🔍 Buscando en Pexels: "${query}" (${perPage} resultados)`);
        results = await this.searchPexels(query, perPage);
        if (results.length) {
          logger.info(
            `[ImageService] ✅ Pexels devolvió ${results.length} resultados para: ${query}`,
          );
        }
      } catch (err) {
        logger.warn('[ImageService] Pexels falló:', err);
      }
    }

    if (!results.length) {
      try {
        logger.info('[ImageService] 🔍 Buscando en Unsplash Source:', query);
        results = await this.searchUnsplashSource(query, perPage);
        if (results.length) {
          logger.info(
            `[ImageService] ✅ Unsplash devolvió ${results.length} resultados para: ${query}`,
          );
        }
      } catch (err) {
        logger.warn('[ImageService] Unsplash Source falló:', err);
      }
    }

    if (!results.length) {
      logger.warn(`[ImageService] 📷 Usando Lorem Picsum fallback para: ${query}`);
      results = this.getPicsumFallback(query, perPage);
    }

    if (results.length) {
      this.cache.set(cacheKey, { results, ts: Date.now() });
    }

    return results;
  }

  private async searchPexels(query: string, perPage: number): Promise<ImageResult[]> {
    try {
      const url = `${this.PEXELS_API}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=square`;
      const response = await fetch(url);

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as PexelsResponse;

      if (!data.photos || data.photos.length === 0) {
        return [];
      }

      return data.photos.map((photo: PexelsPhoto, index: number) => ({
        id: photo.id ?? index,
        url: photo.src?.large ?? photo.src?.medium ?? photo.src?.original ?? '',
        photographer: photo.photographer ?? 'Pexels',
        alt: photo.alt ?? query,
        width: photo.width ?? 800,
        height: photo.height ?? 800,
      }));
    } catch (error) {
      logger.debug('[ImageService] Pexels error:', error);
      return [];
    }
  }

  private async searchPixabay(query: string, perPage: number): Promise<ImageResult[]> {
    const apiKey = env.PIXABAY_API_KEY;
    if (!apiKey) {
      logger.warn('[ImageService] PIXABAY_API_KEY no está configurada');
      return [];
    }

    try {
      const response = await axios.get<PixabayResponse>(this.PIXABAY_API, {
        params: {
          key: apiKey,
          q: query,
          per_page: Math.min(perPage, 20),
          image_type: 'photo',
          safesearch: true,
        },
        timeout: 10000,
      });

      if (!response.data.hits || response.data.hits.length === 0) {
        return [];
      }

      return response.data.hits.map((hit: PixabayHit, index: number) => ({
        id: hit.id ?? index,
        url: hit.webformatURL ?? hit.largeImageURL ?? '',
        photographer: hit.user ?? 'Pixabay',
        alt: query,
        width: hit.webformatWidth ?? 800,
        height: hit.webformatHeight ?? 800,
      }));
    } catch (error) {
      logger.debug('[ImageService] Pixabay error:', error);
      return [];
    }
  }

  /**
   * Unsplash Source redirige a una imagen real de Unsplash sin necesitar key.
   */
  private async searchUnsplashSource(query: string, count: number): Promise<ImageResult[]> {
    const results: ImageResult[] = [];
    const encoded = encodeURIComponent(query);
    const maxAttempts = Math.min(count, 3);

    for (let i = 0; i < maxAttempts; i++) {
      const seed = Math.floor(Math.random() * 10000) + i * 1000;
      const url = `https://source.unsplash.com/800x800/?${encoded}&sig=${seed}`;

      try {
        const resp = await axios.get<ArrayBuffer>(url, {
          timeout: 6000,
          maxRedirects: 5,
          responseType: 'arraybuffer',
          validateStatus: s => s < 400,
        });

        if (resp.status === 200) {
          const axiosResp = resp as AxiosWithResponseUrl;
          const finalUrl = axiosResp.request?.res?.responseUrl ?? url;
          results.push({
            id: seed,
            url: finalUrl,
            photographer: 'Unsplash',
            alt: query,
            width: 800,
            height: 800,
          });
        }
      } catch (error) {
        // Fuente de imágenes caída: se devuelve lo acumulado con fallbacks.
        logger.debug(`[ImageService] Unsplash query failed for "${query}":`, error);
      }
    }

    return results;
  }

  private getPicsumFallback(query: string, count: number): ImageResult[] {
    const results: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      const seed = Math.abs(this.hashString(query + i));
      results.push({
        id: seed,
        url: `https://picsum.photos/seed/${seed}/800/800`,
        photographer: 'Lorem Picsum',
        alt: query,
        width: 800,
        height: 800,
      });
    }
    return results;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

export const imageService = ImageService.getInstance();
