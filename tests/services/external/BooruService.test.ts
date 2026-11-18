/**
 * BooruService.test.ts
 *
 * Image boards (konachan.net, yande.re, danbooru — all verified alive) replace
 * the dead Prince/Delirius image commands and add a generic `!booru <tag>`.
 * Critical pin: the tag blacklist filters out loli/shota/child content even
 * when the random pick lands on it, per source §1.3 of the migration plan.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BooruService,
  booruService,
  isTagBlacklisted,
} from '@/services/external/BooruService.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const konachanPost = (id: number, tags: string, file: string) => ({
  id,
  tags,
  tag_string: tags,
  file_url: file,
});

describe('tag blacklist', () => {
  it('flags underage-related tags in any position', () => {
    expect(isTagBlacklisted('loli')).toBe(true);
    expect(isTagBlacklisted('shotacon maid')).toBe(true);
    expect(isTagBlacklisted('maid child swimsuit')).toBe(true);
    expect(isTagBlacklisted('lolicon')).toBe(true);
  });

  it('allows clean tag strings (no substring false positives)', () => {
    expect(isTagBlacklisted('maid uniform')).toBe(false);
    expect(isTagBlacklisted('kitagawa_marin')).toBe(false);
    // 'young' as a standalone word is blacklisted, but words containing it are not.
    expect(isTagBlacklisted('youngwoman_not_a_tag… x')).toBe(false);
  });
});

describe('BooruService', () => {
  let service: BooruService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BooruService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns a random clean post url from konachan.net', async () => {
    const posts = [
      konachanPost(1, 'maid uniform', 'https://k1/img1.jpg'),
      konachanPost(2, 'nekomimi', 'https://k1/img2.jpg'),
    ];
    fetchMock.mockResolvedValue(jsonResponse(posts));

    const url = await service.randomPost('konachan_net');

    expect(['https://k1/img1.jpg', 'https://k1/img2.jpg']).toContain(url);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('konachan.net/post.json?limit=100');
  });

  it('never returns a blacklisted post, even if it is the only one', async () => {
    const posts = [
      konachanPost(1, 'loli maid', 'https://k1/bad.jpg'),
      konachanPost(2, 'shota', 'https://k1/bad2.jpg'),
    ];
    fetchMock.mockResolvedValue(jsonResponse(posts));

    await expect(service.randomPost('konachan_net')).rejects.toThrow('Sin resultados');
  });

  it('maps danbooru to large_file_url', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: 1, tag_string: 'megumin', large_file_url: 'https://cdn.donmai.us/x.jpg' },
      ]),
    );

    const url = await service.randomPost('danbooru', 'megumin rating:g');

    expect(url).toBe('https://cdn.donmai.us/x.jpg');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('danbooru.donmai.us/posts.json?limit=100');
    expect(fetchMock.mock.calls[0]?.[0]).toContain(encodeURIComponent('megumin rating:g'));
  });

  it('skips mp4/ugoira posts and only serves image files', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: 1, tag_string: 'mori_calliope', large_file_url: 'https://cdn.donmai.us/x.mp4' },
        { id: 2, tag_string: 'mori_calliope', large_file_url: 'https://cdn.donmai.us/y.jpg' },
      ]),
    );

    const url = await service.randomPost('danbooru', 'mori_calliope rating:g');

    expect(url).toBe('https://cdn.donmai.us/y.jpg');
  });

  it('throws on unknown site', async () => {
    await expect(service.randomPost('gelbooru' as never)).rejects.toThrow('gelbooru');
  });

  it('exposes a shared singleton', () => {
    expect(booruService).toBeInstanceOf(BooruService);
  });
});
