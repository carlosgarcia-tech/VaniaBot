/**
 * FacebookDownloader.ts
 *
 * VaniaBot services module exposing `FacebookDownloader`, `FacebookVideo`.
 *
 * @author **Carlos G**
 */

import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { DownloadService, type DownloadResult } from './DownloadService.js';
import { logError } from '@/utils/logger.js';
import { NetworkError } from '@/utils/errors.js';

export interface FacebookVideo {
  title: string;
  author: string;
  url: string;
  thumbnailUrl?: string;
}

export class FacebookDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'Facebook';
  }

  isValidUrl(url: string): boolean {
    return (
      /facebook\.com\/(watch|reel|reels|videos)\//i.test(url) ||
      /facebook\.com\/share\/(v|r|p)\//i.test(url) ||
      /facebook\.com\/[^/]+\/videos\//i.test(url) ||
      /fb\.watch\//i.test(url)
    );
  }

  async getVideoInfo(url: string): Promise<Either<NetworkError, FacebookVideo>> {
    try {
      const output = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--no-playlist', '--quiet', url],
        30000,
      );
      const info = JSON.parse(output.trim().split('\n')[0]);
      return right({
        title: info.title ?? 'Facebook video',
        author: info.uploader ?? info.channel ?? 'unknown',
        url,
        thumbnailUrl: info.thumbnail ?? undefined,
      });
    } catch (error) {
      logError('Facebook getVideoInfo', error);
      return left(
        new NetworkError('Error al obtener info de Facebook', {
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

    const outputPath = this.generateOutputPath('facebook', 'mp4');

    const methods = [
      {
        name: 'yt-dlp facebook',
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
        name: 'yt-dlp facebook fast',
        cmd: 'yt-dlp',
        args: ['-f', 'best', '--no-playlist', '--no-check-certificate', '-o', outputPath, url],
      },
      {
        name: 'yt-dlp facebook fallback',
        cmd: 'yt-dlp',
        args: ['--no-playlist', '--no-check-certificate', '-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }
}
