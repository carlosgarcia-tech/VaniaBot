/**
 * MediafireDownloader.ts
 *
 * VaniaBot services module exposing `MediafireDownloader`, `MediafireInfo`, `mediafireDownloader`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview MediafireDownloader.ts - Download files from Mediafire
 *
 * Downloads files from Mediafire using manual HTML parsing.
 *
 * @module services/download/MediafireDownloader
 */

import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { logger, logError } from '@/utils/logger.js';
import { NetworkError, ValidationError } from '@/utils/errors.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-mediafire');

export interface MediafireInfo {
  filename: string;
  size: string;
  url: string;
}

export type MediafireError = NetworkError | ValidationError;
export type MediafireInfoResult = Either<MediafireError, MediafireInfo>;
export type MediafireDownloadResult = Either<
  MediafireError,
  { filename: string; size: string; url: string; filePath: string }
>;

export class MediafireDownloader {
  private ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async getInfo(url: string): Promise<MediafireInfoResult> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 30000,
      });

      const html = response.data as string;

      const filenameMatch = html.match(/class="filename"[^>]*>([^<]+)<\/span>/i);
      const filesizeMatch = html.match(/class="file-size"[^>]*>([^<]+)<\/span>/i);
      const directLinkMatch =
        html.match(/id="downloadButton"[^>]+href=["']([^"']+)["']/i) ||
        html.match(/href="(https?:\/\/download[^"]+mediafire[^"]+)"/i) ||
        html.match(/a\s+href="([^"]+)"\s+class="[^"]*download[^"]*"/i);

      const filename = filenameMatch ? filenameMatch[1].trim() : null;
      const filesize = filesizeMatch ? filesizeMatch[1].trim() : null;
      const directUrl = directLinkMatch ? directLinkMatch[1].trim() : null;

      if (!filename || !directUrl) {
        return left(new ValidationError('No se pudo extraer info del archivo'));
      }

      return right({
        filename,
        size: filesize || 'Desconocido',
        url: directUrl,
      });
    } catch (error) {
      logger.error('MediafireDownloader.getInfo error:', error);
      return left(
        new NetworkError('Error al obtener info de Mediafire', {
          originalError: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async download(url: string): Promise<MediafireDownloadResult> {
    try {
      this.ensureTmpDir();

      const infoResult = await this.getInfo(url);
      if (infoResult._tag === 'Left') {
        return left(infoResult.left);
      }

      const info = infoResult.right;

      const ext = path.extname(info.filename || 'file');
      const tempPath = path.join(TMP_DIR, `${Date.now()}${ext}`);

      const response = await axios.get(info.url, {
        responseType: 'stream',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      return right({
        filename: info.filename,
        size: info.size,
        url: info.url,
        filePath: tempPath,
      });
    } catch (error) {
      logger.error('MediafireDownloader.download error:', error);
      return left(
        new NetworkError('Error al descargar de Mediafire', {
          originalError: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logError('[MediafireDownloader]', error);
    }
  }
}

export const mediafireDownloader = new MediafireDownloader();
