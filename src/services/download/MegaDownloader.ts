/**
 * MegaDownloader.ts
 *
 * VaniaBot services module exposing `MegaDownloader`, `MegaFileInfo`, `megaDownloader`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview MegaDownloader.ts - Download files from Mega.nz
 *
 * Downloads files from Mega.nz using the megajs package.
 *
 * @module services/download/MegaDownloader
 */

import { File } from 'megajs';
import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { logger, logError } from '@/utils/logger.js';
import { NetworkError, ValidationError } from '@/utils/errors.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-mega');

export interface MegaFileInfo {
  name: string;
  size: number;
}

export type MegaError = NetworkError | ValidationError;
export type MegaInfoResult = Either<MegaError, MegaFileInfo>;
export type MegaDownloadResult = Either<
  MegaError,
  { name: string; size: number; filePath: string }
>;

export class MegaDownloader {
  private ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async getInfo(url: string): Promise<MegaInfoResult> {
    return new Promise(resolve => {
      try {
        const file = File.fromURL(url);
        void file.loadAttributes(err => {
          if (err) {
            resolve(left(new ValidationError('No se pudo obtener info del archivo')));
            return;
          }
          resolve(
            right({
              name: file.name || 'mega-file',
              size: file.size || 0,
            }),
          );
        });
      } catch (error) {
        resolve(
          left(
            new NetworkError('Error al procesar URL de Mega', {
              originalError: error instanceof Error ? error.message : String(error),
            }),
          ),
        );
      }
    });
  }

  async download(url: string): Promise<MegaDownloadResult> {
    return new Promise(resolve => {
      try {
        this.ensureTmpDir();

        const file = File.fromURL(url);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        file.loadAttributes(err => {
          void (async () => {
            if (err) {
              resolve(left(new ValidationError('Error al obtener info del archivo')));
              return;
            }

            const name = file.name || 'mega-file.mp4';
            const tempPath = path.join(TMP_DIR, `${Date.now()}-${name}`);

            try {
              const data = await file.downloadBuffer({});
              fs.writeFileSync(tempPath, data);

              resolve(
                right({
                  name,
                  size: data.length,
                  filePath: tempPath,
                }),
              );
            } catch (downloadErr) {
              logger.error('Mega download error:', downloadErr);
              resolve(
                left(
                  new NetworkError('Error al descargar archivo', {
                    originalError:
                      downloadErr instanceof Error ? downloadErr.message : String(downloadErr),
                  }),
                ),
              );
            }
          })().catch(e => {
            logger.error('Mega download unexpected error:', e);
            resolve(
              left(
                new NetworkError('Error inesperado al descargar de Mega', {
                  originalError: e instanceof Error ? e.message : String(e),
                }),
              ),
            );
          });
        });
      } catch (error) {
        logger.error('MegaDownloader.download error:', error);
        resolve(
          left(
            new NetworkError('Error al descargar de Mega.nz', {
              originalError: error instanceof Error ? error.message : String(error),
            }),
          ),
        );
      }
    });
  }

  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logError('[MegaDownloader]', error);
    }
  }
}

export const megaDownloader = new MegaDownloader();
