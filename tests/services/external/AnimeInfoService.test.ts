/**
 * AnimeInfoService.test.ts
 *
 * Jikan/MAL timed out from this server, so anime info comes from AniList's
 * public GraphQL API (free, no key, verified live 18-nov-2026).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimeInfoService, animeInfoService } from '@/services/external/AnimeInfoService.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('AnimeInfoService', () => {
  let service: AnimeInfoService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnimeInfoService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches an anime by title and maps the fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          Media: {
            title: { romaji: 'Naruto' },
            coverImage: { large: 'https://s4.anilist.co/cover.jpg' },
            description: '<i>Naruto</i> is a ninja story.',
            episodes: 220,
            averageScore: 79,
          },
        },
      }),
    );

    const info = await service.search('naruto');

    expect(info).toEqual({
      title: 'Naruto',
      coverUrl: 'https://s4.anilist.co/cover.jpg',
      description: 'Naruto is a ninja story.',
      episodes: 220,
      score: 79,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://graphql.anilist.co');
  });

  it('resolves an anime by MyAnimeList id (query uses idMal)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          Media: {
            title: { romaji: 'Naruto' },
            coverImage: { large: 'https://s4.anilist.co/cover.jpg' },
            description: '',
            episodes: 220,
            averageScore: 79,
          },
        },
      }),
    );

    const info = await service.byMalId(20);

    expect(info?.title).toBe('Naruto');
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body) as {
      query: string;
      variables: { id: number };
    };
    expect(body.query).toContain('idMal');
    expect(body.variables.id).toBe(20);
  });

  it('returns null when AniList has no match', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { Media: null } }));

    expect(await service.search('zzzz-no-existe')).toBeNull();
  });

  it('throws on http failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);

    await expect(service.search('naruto')).rejects.toThrow('500');
  });

  it('exposes a shared singleton', () => {
    expect(animeInfoService).toBeInstanceOf(AnimeInfoService);
  });
});
