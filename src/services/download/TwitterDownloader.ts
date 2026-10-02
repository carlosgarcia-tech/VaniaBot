/**
 * TwitterDownloader.ts
 *
 * VaniaBot services module exposing `TwitterDownloader`, `TwitterVideo`.
 *
 * @author **Carlos G**
 */

import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { DownloadService, type DownloadResult } from './DownloadService.js';
import { logError } from '@/utils/logger.js';
import { NetworkError } from '@/utils/errors.js';

export interface TwitterVideo {
  title: string;
  author: string;
  url: string;
  thumbnailUrl?: string;
}

export class TwitterDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'Twitter';
  }

  isValidUrl(url: string): boolean {
    return /twitter\.com\/[^/]+\/status\/\d+/i.test(url) || /x\.com\/[^/]+\/status\/\d+/i.test(url);
  }

  async getVideoInfo(url: string): Promise<Either<NetworkError, TwitterVideo>> {
    try {
      const output = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--no-playlist', '--quiet', url],
        30000,
      );
      const info = JSON.parse(output.trim().split('\n')[0]);
      return right({
        title: info.title ?? 'Twitter/X video',
        author: info.uploader ?? info.channel ?? 'unknown',
        url,
        thumbnailUrl: info.thumbnail ?? undefined,
      });
    } catch (error) {
      logError('Twitter getVideoInfo', error);
      return left(
        new NetworkError('Error al obtener info de Twitter', {
          originalError: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async downloadVideo(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return left(validation.left);
    }

    const outputPath = this.generateOutputPath('twitter', 'mp4');

    const methods = [
      {
        name: 'yt-dlp twitter',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'best[height<=720]/best',
          '--concurrent-fragments',
          '8',
          '--buffer-size',
          '32M',
          '--no-playlist',
          '--no-check-certificate',
          '--quiet',
          '--no-warnings',
          '-o',
          outputPath,
          url,
        ],
      },
      {
        name: 'yt-dlp twitter fast',
        cmd: 'yt-dlp',
        args: ['-f', 'best', '--no-playlist', '--no-check-certificate', '-o', outputPath, url],
      },
      {
        name: 'yt-dlp twitter fallback',
        cmd: 'yt-dlp',
        args: ['--no-playlist', '--no-check-certificate', '-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }
}
