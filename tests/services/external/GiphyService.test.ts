/**
 * GiphyService.test.ts
 *
 * Tenor used the dead Delirius glue. Giphy's public GIF API is the free
 * replacement — it needs a GIPHY_API_KEY (free at developers.giphy.com) and
 * fails gracefully without it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GiphyService, giphyService } from '@/services/external/GiphyService.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('GiphyService', () => {
  let service: GiphyService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GiphyService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.GIPHY_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GIPHY_API_KEY;
  });

  it('returns the original gif url for a query', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [{ images: { original: { url: 'https://media.giphy.com/x.gif' } } }],
      }),
    );

    expect(await service.searchGif('happy')).toBe('https://media.giphy.com/x.gif');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('api.giphy.com/v1/gifs/search');
    expect(url).toContain('api_key=test-key');
    expect(url).toContain('rating=pg-13');
  });

  it('throws a clear error without results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await expect(service.searchGif('nada')).rejects.toThrow('Sin resultados');
  });

  it('tells the operator to configure the key when missing', async () => {
    delete process.env.GIPHY_API_KEY;

    await expect(service.searchGif('happy')).rejects.toThrow('GIPHY_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exposes a shared singleton', () => {
    expect(giphyService).toBeInstanceOf(GiphyService);
  });
});
