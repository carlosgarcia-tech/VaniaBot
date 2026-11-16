import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isLeft, isRight } from '../../../src/utils/either.js';
import { TikTokDownloader } from '../../../src/services/download/TikTokDownloader.js';
import { TikTokGuardService } from '../../../src/services/download/TikTokGuard.js';

const TARGETS_OUTPUT = 'chrome ✓\nchrome-131.0.6778.85 ✓\nsafari17_0 ✓\nfirefox135 ✓\nedge101 ✓\n';
const BLOCK_STDERR =
  'ERROR: [TikTok] 7696749231666760967: Unable to download webpage: HTTP Error 403: Forbidden';
const VIDEO_ID = '7696749231666760967';
const CANONICAL = `https://www.tiktok.com/@user/video/${VIDEO_ID}`;

class TestTikTokDownloader extends TikTokDownloader {
  public commands: string[][] = [];
  /** Scripted per-call responses: 'block' fails with the real 403 stderr, 'ok' succeeds. */
  public responses: string[] = [];

  constructor(guard: TikTokGuardService) {
    super(guard);
  }

  /** Fake yt-dlp: honors --list; for --dump-json / downloads honors `responses`. */
  public exec(args: string[]): Promise<string> {
    this.commands.push(args);
    if (args.includes('--list-impersonate-targets')) {
      return Promise.resolve(TARGETS_OUTPUT);
    }
    if (args.includes('--dump-json')) {
      return this.responses.shift() === 'block'
        ? Promise.reject(new Error(BLOCK_STDERR))
        : Promise.resolve(
            JSON.stringify({ title: 'Test video', uploader: 'someone', thumbnail: 'thumb' }),
          );
    }
    if (this.responses[0] === 'block') {
      this.responses.shift();
      return Promise.reject(new Error(BLOCK_STDERR));
    }
    fs.writeFileSync(args[args.indexOf('-o') + 1], 'video-bytes');
    return Promise.resolve('');
  }

  protected runCommand(cmd: string, args: string[]): Promise<string> {
    void cmd;
    return this.exec(args);
  }
}

describe('TikTokDownloader guard integration', () => {
  let tmpDir: string;
  let downloader: TestTikTokDownloader;
  let guard: TikTokGuardService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-downloader-'));
    let currentDownloader: TestTikTokDownloader | null = null;
    guard = new TikTokGuardService({
      runYtDlp: args => {
        if (!currentDownloader) throw new Error('not ready');
        return currentDownloader.exec(args);
      },
      cacheDir: path.join(tmpDir, 'cache'),
      cookiesPath: path.join(tmpDir, 'tiktok_cookies.txt'),
      breakerPath: path.join(tmpDir, 'tiktok_breaker.json'),
      minGapMs: 10,
      jitterMs: 0,
      sleep: async () => undefined,
    });
    downloader = new TestTikTokDownloader(guard);
    currentDownloader = downloader;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes cookies, extractor-retries 0 and impersonation explicitly to yt-dlp', async () => {
    downloader.responses = ['ok', 'ok'];
    await downloader.getVideoInfo(CANONICAL);
    const infoArgs = downloader.commands.find(a => a.includes('--dump-json'));
    expect(infoArgs).toContain('--cookies');
    expect(infoArgs?.[infoArgs.indexOf('--cookies') + 1]).toBe(
      path.join(tmpDir, 'tiktok_cookies.txt'),
    );
    expect(infoArgs).toEqual(
      expect.arrayContaining(['--extractor-retries', '0', '--impersonate', 'chrome']),
    );
  });

  it('serves a cache hit without invoking yt-dlp, even with the breaker open', async () => {
    const source = path.join(tmpDir, 'source.mp4');
    fs.writeFileSync(source, 'cached-video');
    guard.storeInCache(VIDEO_ID, source);
    guard.handleFailure(BLOCK_STDERR); // breaker OPEN
    const result = await downloader.downloadVideo(CANONICAL, '720');
    expect(isRight(result)).toBe(true);
    expect(downloader.commands).toHaveLength(0);
    expect(result.right?.filePath.startsWith(path.join(tmpDir, 'cache'))).toBe(true);
  });

  it('moves a successful download into the cache and records success', async () => {
    downloader.responses = ['ok', 'ok', 'ok'];
    await downloader.getVideoInfo(CANONICAL);
    const result = await downloader.downloadVideo(CANONICAL, '720');
    expect(isRight(result)).toBe(true);
    expect(result.right?.filePath.startsWith(path.join(tmpDir, 'cache'))).toBe(true);
    expect(fs.existsSync(result.right?.filePath as string)).toBe(true);
    // A second download for the same video is served from the cache (no yt-dlp).
    const commandCount = downloader.commands.length;
    const again = await downloader.downloadVideo(CANONICAL, '720');
    expect(downloader.commands.length).toBe(commandCount);
    expect(again.right?.filePath).toBe(result.right?.filePath);
  });

  it('rotates the impersonation target between retries on block errors', async () => {
    downloader.responses = ['ok', 'block', 'block', 'ok', 'ok'];
    await downloader.getVideoInfo(CANONICAL);
    const result = await downloader.downloadVideo(CANONICAL, '720');
    expect(isRight(result)).toBe(true);
    const targets = downloader.commands
      .filter(
        a =>
          a.includes('--impersonate') &&
          !a.includes('--list-impersonate-targets') &&
          !a.includes('--dump-json'),
      )
      .map(a => a[a.indexOf('--impersonate') + 1]);
    expect(targets).toEqual(['chrome', 'chrome-131.0.6778.85', 'safari17_0']);
  });

  it('tries the mobile API fallback once after the web retries fail', async () => {
    downloader.responses = ['ok', 'block', 'block', 'block', 'block', 'block'];
    await downloader.getVideoInfo(CANONICAL);
    const result = await downloader.downloadVideo(CANONICAL, '720');
    expect(isLeft(result)).toBe(true);
    const mobileCalls = downloader.commands.filter(a =>
      a.includes('tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com'),
    );
    expect(mobileCalls).toHaveLength(1);
  });

  it('opens the breaker after failed attempts and propagates the real stderr', async () => {
    fs.writeFileSync(path.join(tmpDir, 'tiktok_cookies.txt'), 'ttwid jar');
    downloader.responses = ['ok', 'block', 'block', 'block', 'block', 'block'];
    await downloader.getVideoInfo(CANONICAL);
    const result = await downloader.downloadVideo(CANONICAL, '720');
    expect(isLeft(result)).toBe(true);
    expect(result.left?.message).toContain('HTTP Error 403');
    expect(guard.isBlocked()).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tiktok_cookies.txt'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'tiktok_cookies.txt.bak'))).toBe(true);
  });

  it('refuses to run yt-dlp with the friendly message while the breaker is open', async () => {
    guard.handleFailure(BLOCK_STDERR);
    const result = await downloader.downloadVideo(CANONICAL, '720');
    expect(isLeft(result)).toBe(true);
    expect(result.left?.message).toMatch(/limitó temporalmente|~15 min/);
    const downloadCalls = downloader.commands.filter(a => !a.includes('--list-impersonate-targets'));
    expect(downloadCalls).toHaveLength(0);
  });

  it('getVideoInfo propagates the real yt-dlp stderr on failure', async () => {
    downloader.responses = ['block'];
    const result = await downloader.getVideoInfo(CANONICAL);
    expect(isLeft(result)).toBe(true);
    expect(result.left?.message).toContain('HTTP Error 403');
  });

  it('cleanup deletes temp files but keeps cached files', async () => {
    const source = path.join(tmpDir, 'source.mp4');
    fs.writeFileSync(source, 'cached-video');
    guard.storeInCache(VIDEO_ID, source);
    const cachedPath = guard.serveFromCache(VIDEO_ID) as string;
    const tempFile = path.join(tmpDir, 'temp.mp4');
    fs.writeFileSync(tempFile, 'temp-video');

    await downloader.cleanup(cachedPath, 1);
    await downloader.cleanup(tempFile, 1);
    await new Promise(r => setTimeout(r, 30));

    expect(fs.existsSync(cachedPath)).toBe(true); // cache stays warm
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  it('rejects option-like URLs before spawning yt-dlp', async () => {
    const info = await downloader.getVideoInfo('--exec=tiktok.com/x');
    expect(isLeft(info)).toBe(true);
    expect(downloader.commands).toHaveLength(0);

    const download = await downloader.downloadVideo('--config-location=tiktok.com/y', '720');
    expect(isLeft(download)).toBe(true);
    expect(downloader.commands.filter(a => !a.includes('--list-impersonate-targets'))).toHaveLength(
      0,
    );
  });

  it('falls through to a download when the cached file vanishes between check and stat', async () => {
    (guard as unknown as { serveFromCache: () => string }).serveFromCache = () =>
      path.join(tmpDir, 'ghost.mp4'); // reported cached, file gone
    const result = await downloader.downloadVideo(CANONICAL, '720');
    expect(isRight(result)).toBe(true);
  });
});
