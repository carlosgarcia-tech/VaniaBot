/**
 * AnimeNewsService.test.ts
 *
 * ANN RSS (verified alive 17-nov-2026, follows redirects) restores !newsanime,
 * which used the dead Delirius anime service. Pins the RSS parsing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AnimeNewsService,
  animeNewsService,
} from '@/services/external/AnimeNewsService.js';

const RSS = `<rss><channel>
<item><title>News One &amp; More</title><link>https://www.animenewsnetwork.com/news/1</link><pubDate>Tue, 17 Nov 2026 20:00:00 -0500</pubDate></item>
<item><title><![CDATA[News Two]]></title><link>https://www.animenewsnetwork.com/news/2</link><pubDate>Tue, 17 Nov 2026 19:00:00 -0500</pubDate></item>
</channel></rss>`;

describe('AnimeNewsService', () => {
  let service: AnimeNewsService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnimeNewsService();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => RSS,
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses the latest items with unescaped titles', async () => {
    const items = await service.latestNews();

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'News One & More',
      link: 'https://www.animenewsnetwork.com/news/1',
      date: 'Tue, 17 Nov 2026 20:00:00 -0500',
    });
    expect(items[1].title).toBe('News Two');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('animenewsnetwork.com/all/rss.xml');
  });

  it('throws on http failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as unknown as Response);

    await expect(service.latestNews()).rejects.toThrow('503');
  });

  it('exposes a shared singleton', () => {
    expect(animeNewsService).toBeInstanceOf(AnimeNewsService);
  });
});
