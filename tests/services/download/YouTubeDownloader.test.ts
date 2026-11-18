/**
 * YouTubeDownloader.test.ts
 *
 * Regression pin for the production failure "play: 145730ms → Connection
 * Closed": the downloader used spawnSync, blocking the event loop for up to
 * 3 minutes — no heartbeats went out, WhatsApp dropped the socket and the
 * audio was never delivered. The download must be asynchronous.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, spawnSync } from 'child_process';
import { writeFileSync, rmSync } from 'fs';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';

vi.mock('child_process', () => ({ spawn: vi.fn(), spawnSync: vi.fn(), execFile: vi.fn() }));

const mockedSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
const mockedSpawnSync = spawnSync as unknown as ReturnType<typeof vi.fn>;

describe('YouTubeDownloader.downloadAudio', () => {
  let downloader: YouTubeDownloader;
  const created: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    downloader = new YouTubeDownloader();
    mockedSpawn.mockImplementation(((_cmd: string, args: string[]) => {
      const out = args[args.indexOf('-o') + 1];
      writeFileSync(out, Buffer.from('fake-mp3'));
      created.push(out);
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, cb: (code: number) => void) => {
          if (event === 'close') setTimeout(() => cb(0), 0);
        },
      };
    }) as never);
  });

  afterEach(() => {
    for (const file of created) rmSync(file, { force: true });
  });

  it('runs yt-dlp asynchronously (never spawnSync, which blocks the event loop)', async () => {
    const result = await downloader.downloadAudio('dQw4w9WgXcQ');

    expect(result._tag).toBe('Right');
    expect(mockedSpawn).toHaveBeenCalled();
    expect(mockedSpawnSync).not.toHaveBeenCalled();
  });

  it('caps audio at a mobile-friendly bitrate so slow uplinks finish', async () => {
    await downloader.downloadAudio('dQw4w9WgXcQ');

    const args = mockedSpawn.mock.calls[0]?.[1] as string[];
    const quality = args[args.indexOf('--audio-quality') + 1];
    expect(Number(quality)).toBeGreaterThanOrEqual(7);
  });

  it('requests a readable gif/mp4 fallback when the song is long', async () => {
    const result = await downloader.downloadAudio('dQw4w9WgXcQ');

    expect(result._tag).toBe('Right');
    expect(result.right.filePath.endsWith('.mp3')).toBe(true);
  });
});
