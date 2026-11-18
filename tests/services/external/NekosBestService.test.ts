/**
 * NekosBestService.test.ts
 *
 * Reactions/animebase used to run on Delirius and Prince Techn (both dead).
 * This pins the nekos.best client: JSON parsing, error surfacing, and the
 * gif→mp4 conversion WhatsApp needs for gifPlayback (with a file cache so a
 * repeated gif is not re-encoded). Uses the real temp dir like the other
 * media tests; files are cleaned up afterwards.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NekosBestService, nekosBestService } from '@/services/external/NekosBestService.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockedSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

/** Fake ffmpeg that "converts" by writing the output path directly. */
const fakeFfmpeg = () =>
  vi.fn((_cmd: string, args: string[]) => {
    writeFileSync(args[args.length - 1], Buffer.from('fake-mp4'));
    return {
      stderr: { on: vi.fn() },
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(0), 0);
      },
    };
  });

const jsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as unknown as Response;

const HUG_JSON = {
  results: [{ url: 'https://nekos.best/api/v2/hug/350aee04-6ec3-40a9-b45e-15c754b9c25d.gif' }],
};
const TEMP_DIR = './data/temp';
const CACHED_MP4 = join(TEMP_DIR, 'gifmp4-350aee04-6ec3-40a9-b45e-15c754b9c25d.mp4');
const TEMP_GIF = join(TEMP_DIR, 'gifmp4-350aee04-6ec3-40a9-b45e-15c754b9c25d.gif');

describe('NekosBestService', () => {
  let service: NekosBestService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NekosBestService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(CACHED_MP4, { force: true });
    rmSync(TEMP_GIF, { force: true });
  });

  it('returns the image URL from the JSON result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(HUG_JSON));

    expect(await service.getImageUrl('neko')).toBe(HUG_JSON.results[0].url);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('https://nekos.best/api/v2/neko');
    expect(fetchMock.mock.calls[0]?.[1]?.headers['User-Agent']).toContain('OrbitBot');
  });

  it('throws with the status when the API fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as unknown as Response);

    await expect(service.getImageUrl('neko')).rejects.toThrow('503');
  });

  it('downloads the gif and converts it to mp4 for gifPlayback', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(HUG_JSON))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as unknown as Response);
    mockedSpawn.mockImplementation(fakeFfmpeg() as never);

    const buffer = await service.getReactionVideo('hug');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    const ffmpegArgs = mockedSpawn.mock.calls[0]?.[1] as string[];
    expect(ffmpegArgs[0]).toBe('-y');
    expect(ffmpegArgs.join(' ')).toContain('-movflags');
    expect(existsSync(CACHED_MP4)).toBe(true);
  });

  it('serves a previously converted gif from cache without spawning ffmpeg', async () => {
    mockedSpawn.mockImplementation(fakeFfmpeg() as never);
    // Produce the cached artifact with the real pipeline once.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(HUG_JSON))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as unknown as Response);
    await service.getReactionVideo('hug');
    const spawnCount = mockedSpawn.mock.calls.length;

    // Second call: only the tiny category lookup happens; the gif download
    // and the ffmpeg conversion must be skipped.
    fetchMock.mockResolvedValue(jsonResponse(HUG_JSON));
    fetchMock.mockClear();
    mockedSpawn.mockClear();
    const cached = await service.getReactionVideo('hug');

    expect(cached.equals(readFileSync(CACHED_MP4))).toBe(true);
    expect(mockedSpawn).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('amount=1');
    expect(spawnCount).toBe(1);
  });

  it('exposes a shared singleton', () => {
    expect(nekosBestService).toBeInstanceOf(NekosBestService);
  });
});
