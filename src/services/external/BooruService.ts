/**
 * BooruService.ts
 *
 * Image-board client (konachan.net, yande.re, danbooru — all verified alive
 * 17-nov-2026) replacing the dead Prince/Delirius image commands and backing
 * the generic `!booru <tag>` command.
 *
 * EVERY result passes the NSFW tag blacklist (loli, shota, child…) — a post
 * with a blacklisted tag is never returned, even if it is the only match.
 * Danbooru anonymous queries accept at most 2 tags; callers must respect that.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

const TIMEOUT_MS = 15000;
const LIMIT = 100;
const USER_AGENT = 'OrbitBot/7.4 (WhatsApp bot)';

type SiteKey = 'konachan_net' | 'yandere' | 'danbooru';

const SITES: Record<SiteKey, { url: string; fileField: 'file_url' | 'large_file_url' }> = {
  konachan_net: { url: 'https://konachan.net/post.json', fileField: 'file_url' },
  yandere: { url: 'https://yande.re/post.json', fileField: 'file_url' },
  danbooru: { url: 'https://danbooru.donmai.us/posts.json', fileField: 'large_file_url' },
};

/**
 * Underage-content blacklist (plan §1.3). Matched as whole words against the
 * space-separated tag string, so `maid` is fine but `child maid` is not.
 */
const BLACKLISTED_TAGS = [
  'loli',
  'lolicon',
  'lolibabu',
  'shota',
  'shotacon',
  'shotacomic',
  'child',
  'toddler',
  'toddlercon',
  'underage',
  'young',
  'infant',
  'baby',
  'flat_chest',
];

export function isTagBlacklisted(tagString: string): boolean {
  const tags = tagString.toLowerCase().split(/\s+/);
  return tags.some(tag => BLACKLISTED_TAGS.includes(tag));
}

interface BooruPost {
  tag_string?: string;
  file_url?: string;
  large_file_url?: string;
}

export class BooruService {
  /** One random image URL for a site (+ optional `tags=a b` query). */
  async randomPost(site: SiteKey, tags = ''): Promise<string> {
    const config = SITES[site];
    if (!config) {
      throw new Error(`booru: unknown site '${site}'`);
    }

    const query = tags ? `&tags=${encodeURIComponent(tags)}` : '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let posts: BooruPost[];
    try {
      const response = await fetch(`${config.url}?limit=${LIMIT}${query}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`booru error: ${response.status}`);
      }
      posts = (await response.json()) as BooruPost[];
    } finally {
      clearTimeout(timeoutId);
    }

    const clean = posts.filter(
      p => !isTagBlacklisted(p.tag_string ?? '') && (p[config.fileField] ?? '').length > 0,
    );
    // Only direct image files: danbooru also serves mp4/zip (ugoira) posts.
    const images = clean.filter(p => {
      const url = p[config.fileField] as string;
      return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
    });
    if (images.length === 0) {
      throw new Error('Sin resultados (o filtrados por la lista negra de tags)');
    }
    const post = images[Math.floor(Math.random() * images.length)];
    return post[config.fileField] as string;
  }
}

export const booruService = new BooruService();
