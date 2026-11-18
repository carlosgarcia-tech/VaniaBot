/**
 * SearchSourcesService.ts
 *
 * Direct fetchers replacing the dead Delirius `search` category. Each source
 * is a public API verified alive from the server (17-nov-2026):
 * Wikipedia REST, npm registry, AniList GraphQL, MangaDex and TMDB.
 *
 * Every method returns a plain shape for the command to render (text reply or
 * image + caption) and null/throws for "not found"/"unreachable".
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

const TIMEOUT_MS = 15000;
const USER_AGENT = 'OrbitBot/7.4 (WhatsApp bot)';

export interface WikiResult {
  title: string;
  extract: string;
  url: string;
}

export interface NpmResult {
  name: string;
  version: string;
  description: string;
}

export interface AnimeResult {
  title: string;
  coverUrl?: string;
  episodes?: number;
  score?: number;
  year?: number;
}

export interface MangaResult {
  title: string;
  coverUrl?: string;
  year?: number;
}

export interface MovieResult {
  title: string;
  year?: string;
  overview?: string;
  posterUrl?: string;
  rating?: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
      ...init,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface AniListMedia {
  title?: { romaji?: string; english?: string };
  coverImage?: { large?: string };
  episodes?: number;
  averageScore?: number;
  seasonYear?: number;
}

interface MangaDexManga {
  id: string;
  attributes?: { title?: Record<string, string>; year?: number };
  relationships?: Array<{ type: string; attributes?: { fileName?: string } }>;
}

export class SearchSourcesService {
  async searchWiki(query: string): Promise<WikiResult> {
    const data = await fetchJson<{
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    }>(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);

    if (!data.extract) {
      throw new Error('Sin resultados en Wikipedia');
    }
    return {
      title: data.title ?? query,
      extract: data.extract,
      url: data.content_urls?.desktop?.page ?? '',
    };
  }

  async searchNpm(query: string): Promise<NpmResult[]> {
    const data = await fetchJson<{ objects?: Array<{ package?: NpmResult }> }>(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`,
    );
    return (data.objects ?? []).map(o => ({
      name: o.package?.name ?? '?',
      version: o.package?.version ?? '?',
      description: o.package?.description || 'Sin descripción',
    }));
  }

  async searchAnime(query: string): Promise<AnimeResult | null> {
    const data = await fetchJson<{ data?: { Media?: AniListMedia } }>(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } coverImage { large } episodes averageScore seasonYear } }`,
          variables: { search: query },
        }),
      },
    );
    const media = data.data?.Media;
    if (!media) return null;
    return {
      title: media.title?.romaji ?? media.title?.english ?? query,
      coverUrl: media.coverImage?.large,
      episodes: media.episodes,
      score: media.averageScore,
      year: media.seasonYear,
    };
  }

  async searchManga(query: string): Promise<MangaResult | null> {
    const data = await fetchJson<{ data?: MangaDexManga[] }>(
      `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=1&includes[]=cover_art`,
    );
    const manga = data.data?.[0];
    if (!manga) return null;
    const title = Object.values(manga.attributes?.title ?? {})[0] ?? query;
    const cover = manga.relationships?.find(r => r.type === 'cover_art')?.attributes?.fileName;
    return {
      title,
      coverUrl: cover ? `https://uploads.mangadex.org/covers/${manga.id}/${cover}` : undefined,
      year: manga.attributes?.year,
    };
  }

  async searchMovie(query: string): Promise<MovieResult | null> {
    const key = process.env.TMDB_API_KEY;
    if (!key) return null;

    const data = await fetchJson<{
      results?: Array<{
        title?: string;
        release_date?: string;
        overview?: string;
        poster_path?: string;
        vote_average?: number;
      }>;
    }>(
      `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(query)}&language=es`,
    );

    const movie = data.results?.[0];
    if (!movie) return null;
    return {
      title: movie.title ?? query,
      year: movie.release_date?.slice(0, 4),
      overview: movie.overview,
      posterUrl: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : undefined,
      rating: movie.vote_average,
    };
  }
}

export const searchSourcesService = new SearchSourcesService();
