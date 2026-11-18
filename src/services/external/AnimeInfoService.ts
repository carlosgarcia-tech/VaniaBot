/**
 * AnimeInfoService.ts
 *
 * AniList public GraphQL client (free, no key, verified alive 18-nov-2026).
 * Replaces the dead Delirius anime-info glue; Jikan/MAL timed out from this
 * server.
 *
 * @author **Carlos G**
 * @created 2026-11-18
 */

const ENDPOINT = 'https://graphql.anilist.co';
const TIMEOUT_MS = 20000;

const FIELDS = `
  title { romaji }
  coverImage { large }
  description(asHtml: false)
  episodes
  averageScore
`;

const QUERY = `query ($search: String) { Media(search: $search, type: ANIME) { ${FIELDS} } }`;
const QUERY_MAL = `query ($id: Int) { Media(idMal: $id, type: ANIME) { ${FIELDS} } }`;

export interface AnimeInfo {
  title: string;
  coverUrl: string;
  description: string;
  episodes: number | null;
  score: number | null;
}

interface AniListMedia {
  title?: { romaji?: string };
  coverImage?: { large?: string };
  description?: string;
  episodes?: number | null;
  averageScore?: number | null;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class AnimeInfoService {
  /** First AniList match for a title, or null. */
  async search(query: string): Promise<AnimeInfo | null> {
    return await this.request(QUERY, { search: query });
  }

  /** Anime by its MyAnimeList id (the id in a myanimelist.net/anime/<id> URL). */
  async byMalId(id: number): Promise<AnimeInfo | null> {
    return await this.request(QUERY_MAL, { id });
  }

  private async request(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<AnimeInfo | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let media: AniListMedia | null;
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`anilist error: ${response.status}`);
      }
      const data = (await response.json()) as { data?: { Media?: AniListMedia | null } };
      media = data.data?.Media ?? null;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!media?.title?.romaji || !media.coverImage?.large) {
      return null;
    }

    return {
      title: media.title.romaji,
      coverUrl: media.coverImage.large,
      description: stripHtml(media.description ?? '').slice(0, 600),
      episodes: media.episodes ?? null,
      score: media.averageScore ?? null,
    };
  }
}

/** Shared WhatsApp caption for `!animeinfo` and `!animeinfourl`. */
export function formatAnimeInfo(info: AnimeInfo): string {
  return (
    `📺 *${info.title}*\n\n` +
    (info.episodes ? `🎞️ Episodios: ${info.episodes}\n` : '') +
    (info.score ? `⭐ Score: ${info.score}/100\n` : '') +
    (info.description ? `\n📝 ${info.description}` : '')
  );
}

export const animeInfoService = new AnimeInfoService();
