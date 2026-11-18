/**
 * YtDlpDownloader.ts
 *
 * Generic yt-dlp downloader for the sites whose Delirius/old-DownloadService
 * glue died: soundcloud, threads, snackvideo, xnxx, xvideos, pornhub.
 * The base DownloadService already provides URL validation (SSRF-safe),
 * multi-method retries, size checks and temp-file cleanup.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { DownloadService, type DownloadResult } from './DownloadService.js';

export class YtDlpDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'YtDlp';
  }

  async downloadVideo(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return validation;
    }

    const outputPath = this.generateOutputPath('video', 'mp4');
    const methods = [
      {
        name: 'yt-dlp 720p',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'best[height<=720]/best',
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
        name: 'yt-dlp best',
        cmd: 'yt-dlp',
        args: ['--no-playlist', '--no-check-certificate', '-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return validation;
    }

    const outputPath = this.generateOutputPath('audio', 'mp3');
    const methods = [
      {
        name: 'yt-dlp mp3',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
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
        name: 'yt-dlp audio raw',
        cmd: 'yt-dlp',
        args: ['-x', '--no-playlist', '--no-check-certificate', '-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }
}

export const ytDlpDownloader = new YtDlpDownloader();
