/**
 * TikTokDownloader.ts
 *
 * OrbitBot services module exposing `TikTokDownloader`, `TikTokVideo`.
 *
 * Every yt-dlp call goes through TikTokGuardService: canonical URL memo,
 * serial queue with minimum gap, per-video cache, persistent circuit
 * breaker and impersonation-target rotation — see docs/TIKTOK_403_DEBUG.md
 * for why (TikTok rate-limits bursts from a single IP).
 *
 * @author **Carlos G**
 */

import fs from 'fs';
import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { DownloadService, type DownloadResult } from './DownloadService.js';
import { NetworkError } from '@/utils/errors.js';
import { logError, logger } from '@/utils/logger.js';
import {
  extractVideoId,
  mobileApiArgs,
  TikTokBlockedError,
  TikTokGuardService,
} from './TikTokGuard.js';

export interface TikTokVideo {
  title: string;
  author: string;
  url: string;
  thumbnailUrl?: string;
  duration?: string;
}

/** Max yt-dlp runs per user request: 3 web retries + 1 mobile-API fallback. */
const MAX_ATTEMPTS = 4;

/**
 * Shared guard so the queue/breaker/cache state lives across command
 * instances; the first created instance provides the exec bridge (its
 * runCommand), later instances only reuse the guard.
 */
let sharedGuard: TikTokGuardService | null = null;
let execBridge: ((args: string[], timeout: number) => Promise<string>) | null = null;

export class TikTokDownloader extends DownloadService {
  private readonly guard: TikTokGuardService;

  constructor(guard?: TikTokGuardService) {
    super();
    if (guard) {
      this.guard = guard;
      return;
    }
    if (!sharedGuard) {
      sharedGuard = new TikTokGuardService({
        runYtDlp: (args, timeout) => {
          if (!execBridge) throw new Error('TikTok downloader not initialized');
          return execBridge(args, timeout);
        },
      });
    }
    this.guard = sharedGuard;
    execBridge = (args, timeout) => this.runCommand('yt-dlp', args, timeout);
  }

  protected getDownloadPrefix(): string {
    return 'TikTok';
  }

  isValidUrl(url: string): boolean {
    return /tiktok\.com\//i.test(url) || /vm\.tiktok\.com\//i.test(url);
  }

  async getVideoInfo(url: string): Promise<Either<NetworkError, TikTokVideo>> {
    try {
      const canonical = await this.guard.canonical(url);
      const videoId = extractVideoId(canonical);
      return await this.guard.guardRun(`info:${videoId ?? canonical}`, async () => {
        const target = await this.guard.impersonateTargetFor(0);
        const output = await this.runCommand(
          'yt-dlp',
          [
            ...this.guard.buildBaseArgs(target),
            '--dump-json',
            '--no-download',
            '--no-playlist',
            '--quiet',
            canonical,
          ],
          30000,
        );
        this.guard.handleSuccess();
        const info = JSON.parse(output.trim().split('\n')[0]);
        return right({
          title: info.title ?? 'TikTok video',
          author: info.uploader ?? info.creator ?? 'unknown',
          url: canonical,
          thumbnailUrl: info.thumbnail ?? undefined,
          duration: info.duration_string ?? undefined,
        });
      });
    } catch (error) {
      this.guard.handleFailure(String((error as Error).message ?? error));
      if (error instanceof TikTokBlockedError) {
        return left(new NetworkError(error.message));
      }
      logError('TikTok getVideoInfo', error);
      return left(
        new NetworkError((error as Error).message, {
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

    const canonical = await this.guard.canonical(url);
    const videoId = extractVideoId(canonical);

    // Cached videos are served even while the breaker is open.
    if (videoId) {
      const cached = this.guard.serveFromCache(videoId);
      if (cached) {
        logger.debug('[TikTok] Serving from cache: ' + videoId);
        return right({
          filePath: cached,
          size: (fs.statSync(cached).size / (1024 * 1024)).toFixed(2),
          source: 'tiktok cache',
        });
      }
    }

    const outputPath = this.generateOutputPath('tiktok', 'mp4');
    try {
      return await this.guard.guardRun(`file:${videoId ?? canonical}`, () =>
        this.runDownloadAttempts(canonical, outputPath, videoId, quality),
      );
    } catch (error) {
      this.guard.handleFailure(String((error as Error).message ?? error));
      if (error instanceof TikTokBlockedError) {
        return left(new NetworkError(error.message));
      }
      logError('TikTok downloadVideo', error);
      return left(new NetworkError((error as Error).message));
    }
  }

  /** Keeps the per-video cache warm: cached files are never deleted. */
  async cleanup(filePath: string, delay: number = 30000): Promise<void> {
    if (this.guard.ownsCachedFile(filePath)) return;
    return super.cleanup(filePath, delay);
  }

  /**
   * Up to 3 web attempts with a different impersonation target each, then
   * one mobile-API fallback. Block errors open the persistent breaker (the
   * closed→open transition also rotates the cookie jar once); success
   * resets it. The real yt-dlp stderr propagates to the user.
   */
  private async runDownloadAttempts(
    canonical: string,
    outputPath: string,
    videoId: string | null,
    quality: string,
  ): Promise<DownloadResult> {
    let lastError: NetworkError | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await this.guard.retryDelay();
        logger.debug(`[TikTok] Retry ${attempt} with next impersonation target`);
      }

      const target = await this.guard.impersonateTargetFor(attempt);
      const isMobileFallback = attempt === MAX_ATTEMPTS - 1;
      const args = [
        ...this.guard.buildBaseArgs(target),
        ...(isMobileFallback ? mobileApiArgs() : []),
        '-f',
        attempt % 2 === 0 ? `best[height<=${quality}]/best` : 'bestvideo+bestaudio/best',
        '--merge-output-format',
        'mp4',
        '--no-playlist',
        '--no-check-certificate',
        '--quiet',
        '--no-warnings',
        '-o',
        outputPath,
        canonical,
      ];

      try {
        await this.runCommand('yt-dlp', args, 180000);

        if (!fs.existsSync(outputPath)) {
          lastError = new NetworkError(`yt-dlp terminó sin archivo (${attempt + 1}º intento)`);
          continue;
        }
        const sizeCheck = this.checkFileSize(outputPath, 'video');
        if (sizeCheck._tag === 'Left') {
          fs.unlinkSync(outputPath);
          return left(sizeCheck.left);
        }

        this.guard.handleSuccess();
        let filePath = outputPath;
        if (videoId) {
          this.guard.storeInCache(videoId, outputPath); // moves the file
          filePath = this.guard.serveFromCache(videoId) ?? outputPath;
        }
        logger.debug(`[TikTok] Download succeeded on attempt ${attempt + 1}`);
        return right({
          filePath,
          size: sizeCheck.right.sizeMB.toString(),
          source: isMobileFallback ? 'yt-dlp tiktok mobile api' : 'yt-dlp tiktok',
        });
      } catch (error) {
        const stderr = (error as Error).message;
        this.guard.handleFailure(stderr);
        lastError = new NetworkError(stderr, { attempt: attempt + 1 });
        logger.debug(`[TikTok] Attempt ${attempt + 1} failed: ${stderr.slice(0, 200)}`);
      }
    }

    return left(lastError ?? new NetworkError('Descarga de TikTok fallida'));
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return left(validation.left);
    }

    const canonical = await this.guard.canonical(url);
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
          canonical,
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
          canonical,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }
}
