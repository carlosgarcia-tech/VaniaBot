/**
 * YouTubeDownloader.ts
 *
 * VaniaBot services module exposing `YouTubeDownloader`.
 *
 * @author **Carlos G**
 */

import fs from 'fs';
import { spawnSync } from 'child_process';
import { left, right } from '@/utils/either.js';
import { DownloadService, type DownloadResult } from './DownloadService.js';
import { searchVideo, type YouTubeVideo } from './YouTubeSearchService.js';
import { ValidationError, NetworkError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

export type { YouTubeVideo };

interface PlatformConfig {
  isTermux: boolean;
  maxAudioSizeMB: number;
  maxVideoSizeMB: number;
}

function detectPlatform(): PlatformConfig {
  const isTermux = Boolean(
    process.env.PREFIX?.includes('com.termux') ||
    process.env.TERMUX_VERSION !== undefined ||
    process.env.PWD?.includes('/data/data/com.termux'),
  );

  return {
    isTermux,
    maxAudioSizeMB: isTermux ? 30 : 50,
    maxVideoSizeMB: isTermux ? 50 : 100,
  };
}

export class YouTubeDownloader extends DownloadService {
  private platform: PlatformConfig;
  private lastThumbnail: string | null = null;

  constructor() {
    super();
    this.platform = detectPlatform();
  }

  protected getDownloadPrefix(): string {
    return 'YouTube';
  }

  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async searchVideo(query: string): Promise<YouTubeVideo | null> {
    const result = await searchVideo(query);
    if (result) {
      this.lastThumbnail = result.thumbnail;
    }
    return result;
  }

  getLastThumbnail(): string | null {
    return this.lastThumbnail;
  }

  async downloadAudio(videoId: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, 'mp3');

    const methods = [
      {
        name: 'yt-dlp audio high',
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
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'yt-dlp audio fast',
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
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'youtube-dl audio',
        cmd: 'youtube-dl',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '5',
          '--no-playlist',
          '--no-check-certificate',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'python3-yt-dlp audio',
        cmd: 'python3',
        args: [
          '-m',
          'yt_dlp',
          '-x',
          '--audio-format',
          'mp3',
          '--no-playlist',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'python-yt-dlp audio',
        cmd: 'python',
        args: [
          '-m',
          'yt_dlp',
          '-x',
          '--audio-format',
          'mp3',
          '--no-playlist',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
    ];

    return this.tryDownloadMethodsWithPlatform(methods, outputPath, 'audio');
  }

  async downloadVideo(videoId: string, quality: string = '720'): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, 'mp4');

    const qualityArg = this.platform.isTermux
      ? 'best[height<=480]/best'
      : `best[height<=${quality}]/best`;

    const methods = [
      {
        name: 'yt-dlp video fast',
        cmd: 'yt-dlp',
        args: [
          '-f',
          qualityArg,
          '--concurrent-fragments',
          '8',
          '--buffer-size',
          '32M',
          '--hls-prefer-ffmpeg',
          '--no-playlist',
          '--no-check-certificate',
          '--quiet',
          '--no-warnings',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'yt-dlp video best',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
          '--no-playlist',
          '--no-check-certificate',
          '--merge-output-format',
          'mp4',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'youtube-dl video',
        cmd: 'youtube-dl',
        args: [
          '-f',
          qualityArg,
          '--no-playlist',
          '--no-check-certificate',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'python3-yt-dlp video',
        cmd: 'python3',
        args: [
          '-m',
          'yt_dlp',
          '-f',
          qualityArg,
          '--no-playlist',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'python-yt-dlp video',
        cmd: 'python',
        args: [
          '-m',
          'yt_dlp',
          '-f',
          qualityArg,
          '--no-playlist',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
    ];

    return this.tryDownloadMethodsWithPlatform(methods, outputPath, 'video');
  }

  private async tryDownloadMethodsWithPlatform(
    methods: Array<{ name: string; cmd: string; args: string[] }>,
    outputPath: string,
    type: 'audio' | 'video',
  ): Promise<DownloadResult> {
    const prefix = this.getDownloadPrefix();
    const tag = prefix ? `[${prefix}]` : '';
    const maxSize = type === 'audio' ? this.platform.maxAudioSizeMB : this.platform.maxVideoSizeMB;
    let lastError: NetworkError | undefined;

    for (const method of methods) {
      try {
        logger.debug(`${tag} Trying ${method.name}...`);

        const result = spawnSync(method.cmd, method.args, {
          timeout: 180000,
          stdio: 'pipe',
        });

        if (result.status !== 0) {
          const errorMsg = result.stderr?.toString() || result.error?.message || 'Unknown error';
          throw new Error(errorMsg);
        }

        let resolvedPath = outputPath;
        if (this.resolveOutputPath) {
          resolvedPath = this.resolveOutputPath(outputPath) ?? outputPath;
        }

        if (fs.existsSync(resolvedPath)) {
          const stats = fs.statSync(resolvedPath);
          const sizeMB = stats.size / (1024 * 1024);

          if (sizeMB > maxSize) {
            fs.unlinkSync(resolvedPath);
            return left(
              new ValidationError(
                `Archivo muy grande: ${sizeMB.toFixed(1)}MB (máx: ${maxSize}MB on ${this.platform.isTermux ? 'Termux' : 'Desktop'})`,
              ),
            );
          }

          logger.debug(`${tag} ${method.name} succeeded: ${sizeMB.toFixed(1)}MB`);

          return right({
            filePath: resolvedPath,
            size: sizeMB.toFixed(1),
            source: method.name,
          });
        }
      } catch (error) {
        const err = error as Error;
        lastError = new NetworkError(err.message, { method: method.name });
        logger.warn(`${tag} ${method.name} failed: ${err.message}`);
        continue;
      }
    }

    return left(
      lastError ||
        new NetworkError('Descarga fallida. Verifica que yt-dlp o youtube-dl estén instalados.'),
    );
  }
}
