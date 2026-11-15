import { describe, it, expect } from 'vitest';
import {
  extractVideoId,
  isCanonicalTikTokUrl,
  cleanCanonicalUrl,
  resolveCanonicalUrl,
} from '../../../src/services/download/TikTokGuard.js';
import { TikTokQueue } from '../../../src/services/download/TikTokGuard.js';

const CANONICAL = 'https://www.tiktok.com/@pepito_el_sigma67/video/7696749231666760967';

describe('TikTokGuard URL helpers', () => {
  describe('isCanonicalTikTokUrl', () => {
    it('accepts @user/video/<id> URLs', () => {
      expect(isCanonicalTikTokUrl(CANONICAL)).toBe(true);
    });

    it('accepts @user/photo/<id> URLs', () => {
      expect(isCanonicalTikTokUrl('https://www.tiktok.com/@user/photo/7467226363544554770')).toBe(
        true,
      );
    });

    it('rejects short links', () => {
      expect(isCanonicalTikTokUrl('https://vt.tiktok.com/ZSpbg9pN4/')).toBe(false);
      expect(isCanonicalTikTokUrl('https://vm.tiktok.com/ZMABCDE/')).toBe(false);
    });
  });

  describe('extractVideoId', () => {
    it('extracts the numeric id from a canonical URL with query string', () => {
      expect(extractVideoId(`${CANONICAL}?is_from_webapp=1&sender_device=pc`)).toBe(
        '7696749231666760967',
      );
    });

    it('extracts the id from a /photo/ post', () => {
      expect(extractVideoId('https://www.tiktok.com/@user/photo/7467226363544554770')).toBe(
        '7467226363544554770',
      );
    });

    it('returns null for short links (id needs network resolution)', () => {
      expect(extractVideoId('https://vt.tiktok.com/ZSpbg9pN4/')).toBeNull();
    });

    it('returns null for non-numeric ids', () => {
      expect(extractVideoId('https://www.tiktok.com/@user/video/notanumber')).toBeNull();
    });

    it('returns null for garbage', () => {
      expect(extractVideoId('https://example.com/whatever')).toBeNull();
    });
  });

  describe('cleanCanonicalUrl', () => {
    it('strips query string and fragment', () => {
      expect(cleanCanonicalUrl(`${CANONICAL}?x=1#frag`)).toBe(CANONICAL);
    });

    it('returns the input untouched when already clean', () => {
      expect(cleanCanonicalUrl(CANONICAL)).toBe(CANONICAL);
    });

    it('returns null for non-canonical URLs', () => {
      expect(cleanCanonicalUrl('https://vt.tiktok.com/ZSpbg9pN4/')).toBeNull();
    });
  });

  describe('resolveCanonicalUrl', () => {
    it('cleans a canonical URL without any network request', async () => {
      let fetchCalls = 0;
      const result = await resolveCanonicalUrl(`${CANONICAL}?x=1`, (async () => {
        fetchCalls++;
        throw new Error('should not fetch');
      }) as typeof fetch);
      expect(result).toBe(CANONICAL);
      expect(fetchCalls).toBe(0);
    });

    it('follows the redirect of a short link once and cleans the final URL', async () => {
      const fakeFetch = (async () => ({
        url: `${CANONICAL}?is_from_webapp=1`,
      })) as unknown as typeof fetch;
      const result = await resolveCanonicalUrl('https://vt.tiktok.com/ZSpbg9pN4/', fakeFetch);
      expect(result).toBe(CANONICAL);
    });

    it('returns the original URL as fallback when the redirect resolution fails', async () => {
      const failingFetch = (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch;
      const short = 'https://vt.tiktok.com/ZSpbg9pN4/';
      const result = await resolveCanonicalUrl(short, failingFetch);
      expect(result).toBe(short);
    });
  });
});

describe('TikTokQueue', () => {
  it('runs tasks in FIFO order with concurrency 1', async () => {
    const queue = new TikTokQueue({ minGapMs: 5, jitterMs: 0 });
    const order: number[] = [];
    await Promise.all([
      queue.enqueue(async () => {
        await new Promise(r => setTimeout(r, 30));
        order.push(1);
        return 'a';
      }),
      queue.enqueue(async () => {
        order.push(2);
        return 'b';
      }),
      queue.enqueue(async () => {
        order.push(3);
        return 'c';
      }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('waits at least minGapMs (+jitter) between task starts', async () => {
    const queue = new TikTokQueue({ minGapMs: 60, jitterMs: 10 });
    const startTimes: number[] = [];
    await Promise.all([
      queue.enqueue(async () => {
        startTimes.push(Date.now());
      }),
      queue.enqueue(async () => {
        startTimes.push(Date.now());
      }),
    ]);
    expect(startTimes.length).toBe(2);
    expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(60);
  });

  it('rejects tasks that would wait longer than maxWaitMs, without blocking the queue', async () => {
    let t = 0;
    const virtualSleep = async (ms: number) => {
      t += ms;
    };
    const queue = new TikTokQueue({
      minGapMs: 5000,
      jitterMs: 0,
      maxWaitMs: 200,
      now: () => t,
      sleep: virtualSleep,
    });
    const first = queue.enqueue(async () => 'first');
    const second = queue.enqueue(async () => 'second');
    await expect(first).resolves.toBe('first');
    await expect(second).rejects.toThrow(/congestionada|momento/i);
    // once the gap elapses, the queue accepts work again
    t += 5000;
    const third = await queue.enqueue(async () => 'third');
    expect(third).toBe('third');
  });

  it('reports the queue position through onQueued', async () => {
    const queue = new TikTokQueue({ minGapMs: 20, jitterMs: 0 });
    const positions: number[] = [];
    const gate = new Promise<void>(r => setTimeout(r, 40));
    await Promise.all([
      queue.enqueue(
        async () => {
          await gate;
        },
        { onQueued: p => positions.push(p) },
      ),
      queue.enqueue(
        async () => undefined,
        { onQueued: p => positions.push(p) },
      ),
    ]);
    expect(positions[0]).toBe(1);
    expect(positions[1]).toBe(2);
  });
});
