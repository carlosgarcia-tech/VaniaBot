/**
 * GifToMp4.test.ts
 *
 * The disk cache is keyed by the gif file name. Purrbot/nekos.best use unique
 * names, but every Giphy gif is literally "giphy.gif" — without the id the
 * second !tenor would replay the first cached gif.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { readdirSync, rmSync, writeFileSync } from 'fs';
import { gifUrlToMp4 } from '@/services/media/GifToMp4.js';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

const mockedSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

describe('gifUrlToMp4 cache key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSpawn.mockImplementation(((_cmd: string, args: string[]) => {
      const output = args[args.length - 1];
      writeFileSync(output, Buffer.from('fake-mp4'));
      return {
        stderr: { on: vi.fn() },
        on: (event: string, cb: (code: number) => void) => {
          if (event === 'close') setTimeout(() => cb(0), 0);
        },
      };
    }) as never);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([0x47, 0x49, 0x46]).buffer,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const file of readdirSync('./data/temp')) {
      if (file.startsWith('gifmp4-abc111') || file.startsWith('gifmp4-xyz999')) {
        rmSync(`./data/temp/${file}`, { force: true });
      }
    }
  });

  it('keeps different Giphy gifs in separate cache files', async () => {
    await gifUrlToMp4('https://media.giphy.com/media/abc111/giphy.gif');
    await gifUrlToMp4('https://media.giphy.com/media/xyz999/giphy.gif');

    // Each gif must be downloaded (no shared "giphy.gif" cache hit).
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
  });
});
