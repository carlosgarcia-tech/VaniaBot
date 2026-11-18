/**
 * PlayStoreService.ts
 *
 * google-play-scraper client (npm package, verified alive 17-nov-2026)
 * restoring `!playstore`, which used the dead Delirius search glue.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import gplay from 'google-play-scraper';

export interface PlayStoreApp {
  appId: string;
  title: string;
  developer: string;
  score: number;
}

export class PlayStoreService {
  /** Term search (max 10 results). */
  async search(term: string): Promise<PlayStoreApp[]> {
    const results = (await gplay.search({
      term,
      num: 10,
    })) as Array<Partial<PlayStoreApp>>;

    return results.map(app => ({
      appId: app.appId ?? '',
      title: app.title ?? 'Sin título',
      developer: app.developer ?? 'Desconocido',
      score: typeof app.score === 'number' ? app.score : 0,
    }));
  }
}

export const playStoreService = new PlayStoreService();
