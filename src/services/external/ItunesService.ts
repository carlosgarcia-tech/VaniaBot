/**
 * ItunesService.ts
 *
 * iTunes Search API client (free, no key, verified alive 18-nov-2026).
 * Restores music search after the dead Delirius glue and Spotify's paid API.
 *
 * @author **Carlos G**
 * @created 2026-11-18
 */

const ENDPOINT = 'https://itunes.apple.com/search';
const TIMEOUT_MS = 15000;

export interface ItunesTrack {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
}

interface ItunesResult {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
}

export class ItunesService {
  /** First song match for a query, or null. */
  async searchSong(query: string): Promise<ItunesTrack | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let results: ItunesResult[];
    try {
      const response = await fetch(
        `${ENDPOINT}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`,
        {
          headers: { 'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)', Accept: 'application/json' },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`itunes error: ${response.status}`);
      }
      const data = (await response.json()) as { results?: ItunesResult[] };
      results = data.results ?? [];
    } finally {
      clearTimeout(timeoutId);
    }

    const track = results[0];
    if (!track?.trackName) {
      return null;
    }

    return {
      title: track.trackName,
      artist: track.artistName ?? 'Desconocido',
      album: track.collectionName ?? 'Desconocido',
      // iTunes serves 100x100 by default; the same path at 600x600 looks sharp.
      coverUrl: (track.artworkUrl100 ?? '').replace('100x100bb', '600x600bb'),
    };
  }
}

export const itunesService = new ItunesService();
