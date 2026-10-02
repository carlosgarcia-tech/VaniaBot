/**
 * InstagramDownloader.ts
 *
 * VaniaBot services module exposing `InstagramDownloader`, `InstagramMedia`.
 *
 * @author **Carlos G**
 */

import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { DownloadService, type DownloadResult } from './DownloadService.js';
import { logError } from '@/utils/logger.js';
import { NetworkError } from '@/utils/errors.js';
import fs from 'fs';

export interface InstagramMedia {
  title: string;
  author: string;
  url: string;
  type: 'video' | 'image' | 'unknown';
  thumbnailUrl?: string;
}

export class InstagramDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'Instagram';
  }

  protected resolveOutputPath(expectedPath: string): string | null {
    if (fs.existsSync(expectedPath)) return expectedPath;

    const dir = expectedPath.substring(0, expectedPath.lastIndexOf('/'));
    const base = expectedPath.substring(expectedPath.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');

    try {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.startsWith(base));
      if (match) return `${dir}/${match}`;
    } catch (error) {
      logError('[InstagramDownloader] Could not list download dir for output resolution', error);
    }

    return null;
  }

  isValidUrl(url: string): boolean {
    return /instagram\.com\/(p|reel|reels|tv|stories)\//i.test(url);
  }

  async getMediaInfo(url: string): Promise<Either<NetworkError, InstagramMedia>> {
    try {
      const output = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--no-playlist', '--quiet', url],
        30000,
      );
      const info = JSON.parse(output.trim().split('\n')[0]);

      const ext: string = info.ext ?? '';
      const type: InstagramMedia['type'] = ['mp4', 'mov', 'webm'].includes(ext)
        ? 'video'
        : ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
          ? 'image'
          : 'unknown';

      return right({
        title: info.title ?? 'Instagram post',
        author: info.uploader ?? info.channel ?? 'unknown',
        url,
        type,
        thumbnailUrl: info.thumbnail ?? undefined,
      });
    } catch (error) {
      logError('Instagram getMediaInfo', error);
      return left(
        new NetworkError('Error al obtener info de Instagram', {
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

    const outputPath = this.generateOutputPath('instagram', 'mp4');

    const methods = [
      {
        name: 'yt-dlp instagram',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'best',
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
        name: 'yt-dlp instagram fast',
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

  async downloadImage(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return left(validation.left);
    }

    const outputPath = this.generateOutputPath('instagram_img', 'jpg');

    const methods = [
      {
        name: 'yt-dlp instagram image',
        cmd: 'yt-dlp',
        args: [
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
        name: 'yt-dlp instagram image fast',
        cmd: 'yt-dlp',
        args: ['--no-playlist', '--no-check-certificate', '-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }
}
