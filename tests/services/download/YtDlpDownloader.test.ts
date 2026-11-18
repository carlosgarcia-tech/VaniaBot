/**
 * YtDlpDownloader.test.ts
 *
 * Generic yt-dlp downloader for the sites that lost their Delirius glue
 * (soundcloud, threads, snackvideo, xnxx/xvideos/pornhub). Pins the flag
 * sets: video caps at 720p, audio extracts to mp3.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, rmSync } from 'fs';
import { YtDlpDownloader, ytDlpDownloader } from '@/services/download/YtDlpDownloader.js';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

const mockedSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

const fakeYtDlp = () =>
  vi.fn((_cmd: string, args: string[]) => {
    const out = args[args.indexOf('-o') + 1] ?? args[args.length - 1];
    writeFileSync(out, Buffer.from('fake-media'));
    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(0), 0);
      },
    };
  });

describe('YtDlpDownloader', () => {
  let service: YtDlpDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new YtDlpDownloader();
    mockedSpawn.mockImplementation(fakeYtDlp() as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads video capping at 720p', async () => {
    const result = await service.downloadVideo('https://example.com/video');

    expect(result._tag).toBe('Right');
    const args = mockedSpawn.mock.calls[0]?.[1] as string[];
    expect(args[0]).toBe('-f');
    expect(args[1]).toContain('best[height<=720]');
    expect(args).toContain('--no-playlist');
    expect(result.right.filePath.endsWith('.mp4')).toBe(true);
    rmSync(result.right.filePath, { force: true });
  });

  it('downloads audio extracted to mp3', async () => {
    const result = await service.downloadAudio('https://example.com/song');

    expect(result._tag).toBe('Right');
    const args = mockedSpawn.mock.calls[0]?.[1] as string[];
    expect(args).toContain('-x');
    expect(args).toContain('--audio-format');
    expect(args[args.indexOf('--audio-format') + 1]).toBe('mp3');
    expect(result.right.filePath.endsWith('.mp3')).toBe(true);
    rmSync(result.right.filePath, { force: true });
  });

  it('rejects invalid urls before spawning', async () => {
    const result = await service.downloadVideo('not a url');

    expect(result._tag).toBe('Left');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('exposes a shared singleton', () => {
    expect(ytDlpDownloader).toBeInstanceOf(YtDlpDownloader);
  });
});
