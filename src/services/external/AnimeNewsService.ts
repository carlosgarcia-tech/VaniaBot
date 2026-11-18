/**
 * AnimeNewsService.ts
 *
 * Anime News Network RSS client (verified alive 17-nov-2026) restoring
 * `!newsanime`, which used the dead Delirius anime service.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

const RSS_URL = 'https://www.animenewsnetwork.com/all/rss.xml';
const TIMEOUT_MS = 20000;

export interface AnimeNewsItem {
  title: string;
  link: string;
  date: string;
}

function unescapeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#xA9;/gi, '©')
    .replace(/&#x27;|&apos;/g, "'");
}

export class AnimeNewsService {
  /** Latest ANN items (max 10). */
  async latestNews(): Promise<AnimeNewsItem[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let xml: string;
    try {
      const response = await fetch(RSS_URL, {
        headers: { 'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`ANN RSS error: ${response.status}`);
      }
      xml = await response.text();
    } finally {
      clearTimeout(timeoutId);
    }

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items.slice(0, 10).map(item => ({
      title: unescapeXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'Sin título').trim(),
      link: (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '').trim(),
      date: (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '').trim(),
    }));
  }
}

export const animeNewsService = new AnimeNewsService();
