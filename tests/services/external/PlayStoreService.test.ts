/**
 * PlayStoreService.test.ts
 *
 * google-play-scraper (npm, verified alive 17-nov-2026) restores !playstore,
 * which used the dead Delirius search glue. Pins term search mapping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayStoreService, playStoreService } from '@/services/external/PlayStoreService.js';

vi.mock('google-play-scraper', () => ({
  default: {
    search: vi.fn().mockResolvedValue([
      { appId: 'com.whatsapp', title: 'WhatsApp', developer: 'Meta', score: 4.1 },
      { appId: 'x', title: 'Other', developer: 'Meta', score: 4.1 },
    ]),
  },
}));

describe('PlayStoreService', () => {
  let service: PlayStoreService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlayStoreService();
  });

  it('searches apps by term and maps the result', async () => {
    const results = await service.search('whatsapp');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      appId: 'com.whatsapp',
      title: 'WhatsApp',
      developer: 'Meta',
      score: 4.1,
    });
  });

  it('exposes a shared singleton', () => {
    expect(playStoreService).toBeInstanceOf(PlayStoreService);
  });
});
