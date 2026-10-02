/**
 * PinterestDownloader.ts
 *
 * VaniaBot services module exposing `PinterestDownloader`, `PinterestMedia`, `pinterestDownloader`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview PinterestDownloader.ts - Download from Pinterest
 *
 * Downloads images and videos from Pinterest.
 *
 * @module services/download/PinterestDownloader
 */

import axios from 'axios';
import { logger, logError } from '@/utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { left, right, type Either } from '@/utils/either.js';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-pinterest');

export interface PinterestMedia {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

export type PinterestError =
  | { code: 'PARSE_ERROR'; message: string }
  | { code: 'NO_CONTENT'; message: string }
  | { code: 'DOWNLOAD_ERROR'; message: string }
  | { code: 'NETWORK_ERROR'; message: string };

export type PinterestResult = Either<PinterestError, PinterestMedia[]>;

export class PinterestDownloader {
  private ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async getMedia(url: string): Promise<PinterestResult> {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      const html = response.data;
      const media: PinterestMedia[] = [];

      const imgMatches = [...html.matchAll(/<img[^>]+srcset=["']([^"']+)["'][^>]*>/gi)];
      for (const match of imgMatches) {
        const srcset = match[1];
        const urls = srcset.split(',').map((s: string) => s.trim().split(' ')[0]);
        const bestUrl = urls[urls.length - 1];
        if (bestUrl && (bestUrl.includes('pinterest') || bestUrl.includes('pinimg'))) {
          const cleanUrl = bestUrl.replace(/&amp;/g, '&');
          if (!media.some(m => m.url === cleanUrl)) {
            media.push({ type: 'image', url: cleanUrl });
          }
        }
      }

      const jsonLdMatch = html.match(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
      );
      if (jsonLdMatch) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data?.image) {
            const imgUrl = typeof data.image === 'string' ? data.image : data.image?.[0];
            if (imgUrl && !media.some(m => m.url === imgUrl)) {
              media.unshift({ type: 'image', url: imgUrl });
            }
          }
          if (data?.video?.contentUrl) {
            const vidUrl =
              typeof data.video.contentUrl === 'string'
                ? data.video.contentUrl
                : data.video?.contentUrl?.[0];
            if (vidUrl) {
              media.unshift({ type: 'video', url: vidUrl });
            }
          }
        } catch (error) {
          logError('[PinterestDownloader]', error);
        }
      }

      if (media.length === 0) {
        const ogImageMatch = html.match(
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        );
        if (ogImageMatch) {
          media.push({ type: 'image', url: ogImageMatch[1] });
        }
      }

      if (media.length === 0) {
        return left({ code: 'NO_CONTENT', message: 'No se encontró contenido descargable' });
      }

      return right(media);
    } catch (error) {
      logger.error('PinterestDownloader.getMedia error:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return left({
        code: 'NETWORK_ERROR',
        message: `Error al obtener contenido de Pinterest: ${message}`,
      });
    }
  }

  async downloadImage(imageUrl: string): Promise<Either<PinterestError, string>> {
    try {
      this.ensureTmpDir();

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const ext = imageUrl.includes('.gif') ? 'gif' : 'jpg';
      const tempPath = path.join(TMP_DIR, `${Date.now()}.${ext}`);
      fs.writeFileSync(tempPath, Buffer.from(response.data));

      return right(tempPath);
    } catch (error) {
      logger.error('PinterestDownloader.downloadImage error:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return left({ code: 'DOWNLOAD_ERROR', message: `Error al descargar imagen: ${message}` });
    }
  }

  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logError('[PinterestDownloader]', error);
    }
  }
}

export const pinterestDownloader = new PinterestDownloader();
