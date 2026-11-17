/**
 * FallbackAPIService.test.ts
 *
 * Jikan shut down its public API (2026-10-01), so anime recommendations died.
 * These tests pin the new chain: AniList GraphQL → Kitsu REST → static list.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { FallbackAPIService } from '@/services/external/FallbackAPIService.js';

vi.mock('axios');
const mockedAxios = axios as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

const freshService = () => FallbackAPIService.getInstance();

const ANILIST_MEDIA = {
  data: {
    data: {
      Page: {
        media: [
          {
            title: { romaji: 'Cowboy Bebop' },
            episodes: 26,
            description: 'Bounty hunters in space. <br>See you, space cowboy.',
          },
        ],
      },
    },
  },
};

const KITSU_MEDIA = {
  data: {
    data: [
      {
        attributes: {
          canonicalTitle: 'Trigun',
          episodeCount: 26,
          synopsis: 'A gunman with a 60 billion double dollar bounty.',
        },
      },
    ],
  },
};

describe('FallbackAPIService anime recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // fresh cache per test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (freshService() as any).animeCache = new Map();
  });

  it('formats an AniList hit with title, episodes and tag-free description', async () => {
    mockedAxios.post.mockResolvedValue(ANILIST_MEDIA);

    const result = await freshService().getAnimeRecommendation();

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://graphql.anilist.co',
      expect.objectContaining({ query: expect.stringContaining('Page') }),
      expect.objectContaining({ timeout: 5000 }),
    );
    expect(result).toContain('Cowboy Bebop');
    expect(result).toContain('26 episodios');
    expect(result).toContain('Bounty hunters in space.');
    expect(result).not.toContain('<br>');
  });

  it('falls back to Kitsu when AniList fails', async () => {
    mockedAxios.post.mockRejectedValue(new Error('anilist down'));
    mockedAxios.get.mockResolvedValue(KITSU_MEDIA);

    const result = await freshService().getAnimeRecommendation();

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://kitsu.io/api/edge/anime',
      expect.objectContaining({ params: expect.objectContaining({ 'page[limit]': 10 }) }),
    );
    expect(result).toContain('Trigun');
    expect(result).toContain('26 episodios');
  });

  it('returns the static list when both APIs fail', async () => {
    mockedAxios.post.mockRejectedValue(new Error('anilist down'));
    mockedAxios.get.mockRejectedValue(new Error('kitsu down'));

    const result = await freshService().getAnimeRecommendation();

    expect(result).toMatch(/\*\w[\s\S]*\*/);
    expect(result).toContain('📝');
  });

  it('serves repeated calls from cache without hitting the APIs again', async () => {
    mockedAxios.post.mockResolvedValue(ANILIST_MEDIA);

    await freshService().getAnimeRecommendation();
    await freshService().getAnimeRecommendation();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
