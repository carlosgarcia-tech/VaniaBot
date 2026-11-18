/**
 * NhentaiService.test.ts
 *
 * nhentai.net/api/v2 is alive (verified 18-nov-2026) and keeps the NSFW
 * doujin commands working. The fixtures mirror the REAL v2 payloads: detail
 * carries `cover.path` (relative to t.nhentai.net), `title` as an object and
 * `tags` as { name } objects; search items carry ids only, so the service must
 * resolve them through the detail endpoint before trusting the blacklist.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NhentaiService, nhentaiService } from '@/services/external/NhentaiService.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const GALLERY = {
  id: 698288,
  media_id: '4337863',
  title: { english: 'Test Gallery', japanese: 'テスト', pretty: 'Test Gallery' },
  num_pages: 85,
  cover: { path: 'galleries/4337863/cover.webp.webp' },
  thumbnail: { path: 'galleries/4337863/thumb.webp' },
  tags: [{ name: 'doujinshi' }, { name: 'big breasts' }, { name: 'sole female' }],
};

describe('NhentaiService', () => {
  let service: NhentaiService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NhentaiService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a verified cover for a gallery code', async () => {
    fetchMock.mockResolvedValue(jsonResponse(GALLERY));

    const result = await service.getGallery('698288');

    expect(result).toEqual({
      title: 'Test Gallery',
      coverUrl: 'https://t.nhentai.net/galleries/4337863/cover.webp.webp',
      pages: 85,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v2/galleries/698288');
  });

  it('rejects a gallery carrying a blacklisted underage tag', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...GALLERY, tags: [{ name: 'lolicon' }, { name: 'sole female' }] }),
    );

    await expect(service.getGallery('698288')).rejects.toThrow('bloqueada');
  });

  it('searches by title and skips blacklisted hits via the detail endpoint', async () => {
    const searchItem = { id: 111, media_id: '1', num_pages: 10, tags: [] };
    fetchMock.mockImplementation((async (url: string) => {
      if (url.includes('/search')) {
        return jsonResponse({ result: [searchItem, { ...searchItem, id: 222, media_id: '2' }] });
      }
      if (url.endsWith('/galleries/111')) {
        return jsonResponse({ ...GALLERY, id: 111, tags: [{ name: 'shotacon' }] });
      }
      return jsonResponse({ ...GALLERY, id: 222, media_id: '2' });
    }) as unknown as typeof fetch);

    const result = await service.search('test');

    expect(result?.coverUrl).toBe('https://t.nhentai.net/galleries/4337863/cover.webp.webp');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns null when nothing matches', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: [] }));

    expect(await service.search('zzzz')).toBeNull();
  });

  it('exposes a shared singleton', () => {
    expect(nhentaiService).toBeInstanceOf(NhentaiService);
  });
});
