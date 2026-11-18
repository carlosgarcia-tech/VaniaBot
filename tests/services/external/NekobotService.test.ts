/**
 * NekobotService.test.ts
 *
 * nekobot.xyz (verified alive 17-nov-2026) restores the NSFW anime-image
 * commands that died with Delirius/Prince: `hentai`, `hneko`, `hwaifu`
 * (via hkitsune), `boobs`, `oppai`. Pins the `{success, message}` parsing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NekobotService, nekobotService } from '@/services/external/NekobotService.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('NekobotService', () => {
  let service: NekobotService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NekobotService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns the message url for a working type', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        message: 'https://i0.nekobot.xyz/0/b/5/x.jpg',
      }),
    );

    expect(await service.getImage('hneko')).toBe('https://i0.nekobot.xyz/0/b/5/x.jpg');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://nekobot.xyz/api/image?type=hneko');
  });

  it('throws when success is false or the url is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, message: null }));

    await expect(service.getImage('hneko')).rejects.toThrow('hneko');
  });

  it('throws with the status on HTTP failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as unknown as Response);

    await expect(service.getImage('hentai')).rejects.toThrow('503');
  });

  it('exposes a shared singleton', () => {
    expect(nekobotService).toBeInstanceOf(NekobotService);
  });
});
