/**
 * PurrbotService.test.ts
 *
 * Purrbot (api.purrbot.site/v2, verified alive) restores the 9 NSFW
 * reaction gifs that died with Delirius. Pins JSON parsing and the shared
 * gif→mp4 pipeline reuse.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { PurrbotService, purrbotService } from '@/services/external/PurrbotService.js';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response;

const HUG_JSON = {
  error: false,
  link: 'https://cdn.purrbot.site/nsfw/fuck/gif/fuck_271.gif',
};

describe('PurrbotService', () => {
  let service: PurrbotService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PurrbotService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(join('./data/temp', 'gifmp4-fuck_271.gif'), { force: true });
    rmSync(join('./data/temp', 'gifmp4-fuck_271.mp4'), { force: true });
  });

  it('fetches the v2 endpoint and converts the gif link', async () => {
    fetchMock.mockResolvedValue(jsonResponse(HUG_JSON));
    (spawn as unknown as ReturnType<typeof vi.fn>).mockImplementation(((_cmd: string, args: string[]) => {
      writeFileSync(args[args.length - 1], Buffer.from('fake-mp4'));
      return { stderr: { on: vi.fn() }, on: (ev: string, cb: (c: number) => void) => { if (ev === 'close') setTimeout(() => cb(0), 0); } };
    }) as never);

    const buf = await service.getReactionVideo('nsfw/fuck');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.purrbot.site/v2/img/nsfw/fuck/gif');
    expect(buf.length).toBeGreaterThan(0);
  });

  it('throws when the API reports error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: true, link: null }));

    await expect(service.getReactionVideo('nsfw/fuck')).rejects.toThrow();
  });

  it('throws on HTTP failure with the status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as unknown as Response);

    await expect(service.getReactionVideo('nsfw/fuck')).rejects.toThrow('503');
  });

  it('exposes a shared singleton', () => {
    expect(purrbotService).toBeInstanceOf(PurrbotService);
  });
});
