/**
 * TikTokDownloader.ts
 *
 * VaniaBot services module exposing `TikTokDownloader`, `TikTokVideo`.
 *
 * @author **Carlos G**
 */

import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { DownloadService, type DownloadResult } from './DownloadService.js';
import { logError } from '@/utils/logger.js';
import { NetworkError } from '@/utils/errors.js';

export interface TikTokVideo {
  title: string;
  author: string;
  url: string;
  thumbnailUrl?: string;
  duration?: string;
}

export class TikTokDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'TikTok';
  }

  isValidUrl(url: string): boolean {
    return /tiktok\.com\//i.test(url) || /vm\.tiktok\.com\//i.test(url);
  }

  async getVideoInfo(url: string): Promise<Either<NetworkError, TikTokVideo>> {
    try {
      const output = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--no-playlist', '--quiet', url],
        30000,
      );
      const info = JSON.parse(output.trim().split('\n')[0]);
      return right({
        title: info.title ?? 'TikTok video',
        author: info.uploader ?? info.creator ?? 'unknown',
        url,
        thumbnailUrl: info.thumbnail ?? undefined,
        duration: info.duration_string ?? undefined,
      });
    } catch (error) {
      logError('TikTok getVideoInfo', error);
      return left(
        new NetworkError('Error al obtener info del video', {
          originalError: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async downloadVideo(url: string, quality: string = '720'): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return left(validation.left);
    }

    const outputPath = this.generateOutputPath('tiktok', 'mp4');

    const methods = [
      {
        name: 'yt-dlp tiktok',
        cmd: 'yt-dlp',
        args: [
          '-f',
          `best[height<=${quality}]/best`,
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
        name: 'yt-dlp tiktok fast',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'bestvideo+bestaudio/best',
          '--merge-output-format',
          'mp4',
          '--no-playlist',
          '--no-check-certificate',
          '-o',
          outputPath,
          url,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return left(validation.left);
    }

    const outputPath = this.generateOutputPath('tiktok_audio', 'mp3');

    const methods = [
      {
        name: 'yt-dlp tiktok audio',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '5',
          '--concurrent-fragments',
          '8',
          '--buffer-size',
          '16M',
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
        name: 'yt-dlp tiktok audio fast',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '8',
          '--no-playlist',
          '--no-check-certificate',
          '-o',
          outputPath,
          url,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }
}
