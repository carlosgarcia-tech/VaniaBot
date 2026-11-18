/**
 * ItunesService.test.ts
 *
 * !spotifysrc used the dead Delirius search. Spotify's Web API is no longer
 * free, so music search uses the iTunes Search API (free, no key, verified
 * live 18-nov-2026) and returns cover + title + artist.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ItunesService, itunesService } from '@/services/external/ItunesService.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('ItunesService', () => {
  let service: ItunesService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ItunesService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches a song and maps artwork to a usable url', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        resultCount: 1,
        results: [
          {
            trackName: 'Despacito',
            artistName: 'Luis Fonsi',
            collectionName: 'Vida',
            artworkUrl100: 'https://is1.mzstatic.com/image/100x100bb.jpg',
          },
        ],
      }),
    );

    const track = await service.searchSong('despacito');

    expect(track).toEqual({
      title: 'Despacito',
      artist: 'Luis Fonsi',
      album: 'Vida',
      coverUrl: 'https://is1.mzstatic.com/image/600x600bb.jpg',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('itunes.apple.com/search');
  });

  it('returns null without results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ resultCount: 0, results: [] }));

    expect(await service.searchSong('zzzz')).toBeNull();
  });

  it('exposes a shared singleton', () => {
    expect(itunesService).toBeInstanceOf(ItunesService);
  });
});
