/**
 * SearchSourcesService.test.ts
 *
 * Delirius `search` is dead. These tests pin the direct fetchers that replace
 * it for each search command: Wikipedia, npm registry, AniList, MangaDex and
 * TMDB (poster requires the key).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchSourcesService } from '@/services/external/SearchSourcesService.js';

const jsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as Response;

describe('SearchSourcesService', () => {
  let service: SearchSourcesService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TMDB_API_KEY;
    service = new SearchSourcesService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('wiki', () => {
    it('returns title, extract and url from the Wikipedia REST summary', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          title: 'México',
          extract: 'País de América del Norte.',
          content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/México' } },
        }),
      );

      const result = await service.searchWiki('Mexico');

      expect(result).toEqual({
        title: 'México',
        extract: 'País de América del Norte.',
        url: 'https://es.wikipedia.org/wiki/México',
      });
      expect(fetchMock.mock.calls[0]?.[0]).toContain('es.wikipedia.org/api/rest_v1/page/summary/Mexico');
    });

    it('throws when the article does not exist (404)', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);

      await expect(service.searchWiki('xyzzy-nada')).rejects.toThrow('404');
    });
  });

  describe('npm', () => {
    it('returns the top packages with name, version and description', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          objects: [
            { package: { name: 'baileys', version: '7.0.0', description: 'WhatsApp library' } },
            { package: { name: 'baileys-x', version: '1.0.0', description: '' } },
          ],
        }),
      );

      const results = await service.searchNpm('baileys');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        name: 'baileys',
        version: '7.0.0',
        description: 'WhatsApp library',
      });
      expect(results[1]?.description).toBe('Sin descripción');
    });
  });

  describe('anilist', () => {
    it('POSTs the GraphQL search and maps the media fields', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          data: {
            Media: {
              title: { romaji: 'Naruto', english: 'Naruto' },
              coverImage: { large: 'https://s4.anilist.co/naruto.jpg' },
              episodes: 220,
              averageScore: 78,
              seasonYear: 2002,
            },
          },
        }),
      );

      const result = await service.searchAnime('Naruto');

      expect(result?.title).toBe('Naruto');
      expect(result?.coverUrl).toBe('https://s4.anilist.co/naruto.jpg');
      expect(result?.episodes).toBe(220);
      expect(result?.score).toBe(78);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://graphql.anilist.co');
      expect((fetchMock.mock.calls[0]?.[1] as { body: string }).body).toContain('Naruto');
    });

    it('returns null when nothing is found', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: { Media: null } }));

      expect(await service.searchAnime('nada-existe')).toBeNull();
    });
  });

  describe('manga', () => {
    it('maps MangaDex data and its cover relationship', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          data: [
            {
              id: 'manga-id-1',
              attributes: { title: { en: 'One Piece' }, year: 1997 },
              relationships: [{ type: 'cover_art', attributes: { fileName: 'cover.jpg' } }],
            },
          ],
        }),
      );

      const result = await service.searchManga('one piece');

      expect(result?.title).toBe('One Piece');
      expect(result?.coverUrl).toBe('https://uploads.mangadex.org/covers/manga-id-1/cover.jpg');
      expect(result?.year).toBe(1997);
      expect(fetchMock.mock.calls[0]?.[0]).toContain('api.mangadex.org/manga');
    });

    it('returns null on empty results', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

      expect(await service.searchManga('nada')).toBeNull();
    });
  });

  describe('movie', () => {
    it('returns null without a TMDB key', async () => {
      expect(await service.searchMovie('Matrix')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('maps the TMDB search result and poster URL with a key', async () => {
      process.env.TMDB_API_KEY = 'k';
      fetchMock.mockResolvedValue(
        jsonResponse({
          results: [
            {
              title: 'The Matrix',
              release_date: '1999-03-31',
              overview: 'Reality is a simulation.',
              poster_path: '/matrix.jpg',
              vote_average: 8.2,
            },
          ],
        }),
      );

      const result = await service.searchMovie('matrix');

      expect(result?.title).toBe('The Matrix');
      expect(result?.posterUrl).toBe('https://image.tmdb.org/t/p/w500/matrix.jpg');
      expect(result?.year).toBe('1999');
      expect(fetchMock.mock.calls[0]?.[0]).toContain('api.themoviedb.org/3/search/movie');
    });
  });
});
