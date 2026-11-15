import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  extractVideoId,
  isCanonicalTikTokUrl,
  cleanCanonicalUrl,
  resolveCanonicalUrl,
} from '../../../src/services/download/TikTokGuard.js';
import { TikTokQueue, TikTokFileCache, createInFlightDedupe } from '../../../src/services/download/TikTokGuard.js';
import {
  TikTokBreaker,
  isTikTokBlockError,
  rotateCookieJar,
} from '../../../src/services/download/TikTokGuard.js';
import { JsonFileStore } from '../../../src/utils/JsonFileStore.js';

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

describe('TikTokFileCache', () => {
  let tmpDir: string;
  let cacheDir: string;
  let sourceDir: string;
  let clock: number;

  const writeSource = (name: string, content = 'x'.repeat(100)): string => {
    const p = path.join(sourceDir, name);
    fs.writeFileSync(p, content);
    return p;
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-cache-'));
    cacheDir = path.join(tmpDir, 'cache');
    sourceDir = path.join(tmpDir, 'source');
    fs.mkdirSync(sourceDir, { recursive: true });
    clock = Date.now();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('misses when empty', () => {
    const cache = new TikTokFileCache({ dir: cacheDir, now: () => clock });
    expect(cache.get('111')).toBeNull();
  });

  it('hits after storing, returning an existing file path', () => {
    const cache = new TikTokFileCache({ dir: cacheDir, now: () => clock });
    const source = writeSource('tiktok_1.mp4');
    cache.store('111', source);
    const cached = cache.get('111');
    expect(cached).not.toBeNull();
    expect(fs.existsSync(cached as string)).toBe(true);
    expect(fs.statSync(cached as string).size).toBe(100);
  });

  it('misses once the TTL elapses (injectable clock)', () => {
    let now = Date.now();
    const cache = new TikTokFileCache({ dir: cacheDir, ttlMs: 60000, now: () => now });
    cache.store('111', writeSource('tiktok_1.mp4'));
    now += 61000;
    expect(cache.get('111')).toBeNull();
  });

  it('misses when the cached file was deleted externally', () => {
    const cache = new TikTokFileCache({ dir: cacheDir, now: () => clock });
    cache.store('111', writeSource('tiktok_1.mp4'));
    fs.rmSync(cacheDir, { recursive: true, force: true });
    expect(cache.get('111')).toBeNull();
  });

  it('evicts the oldest entries when the total size limit is exceeded', () => {
    const cache = new TikTokFileCache({ dir: cacheDir, maxTotalBytes: 250, now: () => clock });
    cache.store('111', writeSource('a.mp4', 'a'.repeat(100)));
    cache.store('222', writeSource('b.mp4', 'b'.repeat(100)));
    cache.store('333', writeSource('c.mp4', 'c'.repeat(100)));
    expect(cache.get('111')).toBeNull(); // oldest, evicted
    expect(cache.get('222')).not.toBeNull();
    expect(cache.get('333')).not.toBeNull();
  });
});

describe('createInFlightDedupe', () => {
  it('shares one in-flight promise for the same key', async () => {
    const dedupe = createInFlightDedupe();
    let calls = 0;
    const task = async () => {
      calls++;
      await new Promise(r => setTimeout(r, 20));
      return 'result';
    };
    const [a, b] = await Promise.all([dedupe('111', task), dedupe('111', task)]);
    expect(calls).toBe(1);
    expect(a).toBe('result');
    expect(b).toBe('result');
  });

  it('runs separate keys independently', async () => {
    const dedupe = createInFlightDedupe();
    let calls = 0;
    const task = async () => {
      calls++;
      return calls;
    };
    await Promise.all([dedupe('111', task), dedupe('222', task)]);
    expect(calls).toBe(2);
  });

  it('does not cache failures — the next call retries', async () => {
    const dedupe = createInFlightDedupe();
    let calls = 0;
    const failing = async () => {
      calls++;
      throw new Error('boom');
    };
    await expect(dedupe('111', failing)).rejects.toThrow('boom');
    await expect(dedupe('111', failing)).rejects.toThrow('boom');
    expect(calls).toBe(2);
  });
});

describe('isTikTokBlockError', () => {
  // Real strings captured in docs/TIKTOK_403_DEBUG.md
  it('flags the 403 webpage error', () => {
    expect(
      isTikTokBlockError(
        'ERROR: [TikTok] 7696749231666760967: Unable to download webpage: HTTP Error 403: Forbidden (caused by <HTTPError 403: Forbidden>)',
      ),
    ).toBe(true);
  });

  it('flags the explicit IP block message', () => {
    expect(
      isTikTokBlockError(
        'ERROR: [TikTok] 7664304839815384351: Your IP address is blocked from accessing this post',
      ),
    ).toBe(true);
  });

  it('flags the bot-check "unexpected response" error', () => {
    expect(
      isTikTokBlockError(
        'ERROR: [TikTok] 7696749231666760967: Unexpected response from webpage request; please report this issue on  https://github.com/yt-dlp/yt-dlp/issues?q=',
      ),
    ).toBe(true);
  });

  it('does NOT flag DNS failures (they are not IP reputation blocks)', () => {
    expect(
      isTikTokBlockError(
        "ERROR: [TikTok] 7664304839815384351: Unable to download webpage: HTTPSConnection(host='www.tiktok.com', port=443): Failed to resolve 'www.tiktok.com' ([Errno -5])",
      ),
    ).toBe(false);
  });

  it('does NOT flag unsupported URL or impersonation warnings', () => {
    expect(isTikTokBlockError('ERROR: Unsupported URL: https://www.tiktok.com/@user/photo/1')).toBe(
      false,
    );
    expect(
      isTikTokBlockError(
        'WARNING: [TikTok] The extractor is attempting impersonation, but no impersonate target is available.',
      ),
    ).toBe(false);
  });
});

describe('TikTokBreaker', () => {
  let tmpDir: string;
  let statePath: string;
  let clock: number;

  const makeBreaker = (storePath = statePath) =>
    new TikTokBreaker({
      store: new JsonFileStore<{ openUntil: number; backoffLevel: number }>({
        filePath: storePath,
        defaults: () => ({ openUntil: 0, backoffLevel: 0 }),
      }),
      baseMinMs: 15 * 60 * 1000,
      maxMinMs: 120 * 60 * 1000,
      now: () => clock,
    });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-breaker-'));
    statePath = path.join(tmpDir, 'tiktok_breaker.json');
    clock = Date.now();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts closed', () => {
    expect(makeBreaker().isOpen()).toBe(false);
  });

  it('opens for the base pause on the first block (15 min)', () => {
    const breaker = makeBreaker();
    breaker.recordBlock();
    expect(breaker.isOpen()).toBe(true);
    expect(breaker.minutesLeft()).toBe(15);
  });

  it('doubles the pause on consecutive blocks: 15 → 30 → 60 → 120 (capped)', () => {
    const breaker = makeBreaker();
    breaker.recordBlock();
    expect(breaker.minutesLeft()).toBe(15);
    clock += 16 * 60 * 1000; // the pause elapses, a new download hits the block again
    breaker.recordBlock();
    expect(breaker.minutesLeft()).toBe(30);
    clock += 31 * 60 * 1000;
    breaker.recordBlock();
    expect(breaker.minutesLeft()).toBe(60);
    clock += 61 * 60 * 1000;
    breaker.recordBlock();
    expect(breaker.minutesLeft()).toBe(120);
    clock += 121 * 60 * 1000;
    breaker.recordBlock();
    expect(breaker.minutesLeft()).toBe(120); // capped
  });

  it('resets the backoff after a success', () => {
    const breaker = makeBreaker();
    breaker.recordBlock();
    clock += 16 * 60 * 1000;
    breaker.recordBlock(); // level 2 → 30 min
    clock += 31 * 60 * 1000;
    breaker.recordSuccess();
    expect(breaker.isOpen()).toBe(false);
    breaker.recordBlock();
    expect(breaker.minutesLeft()).toBe(15); // back to base
  });

  it('keeps serving the cache while open (isOpen does not affect cache reads)', () => {
    const breaker = makeBreaker();
    breaker.recordBlock();
    // cache reads are independent: the guard just skips yt-dlp, not the cache
    expect(breaker.isOpen()).toBe(true);
    expect(breaker.minutesLeft()).toBeGreaterThan(0);
  });

  it('survives a restart through the persisted store', () => {
    const breaker = makeBreaker();
    breaker.recordBlock();
    const rehydrated = makeBreaker(); // new instance, same file — like a container restart
    expect(rehydrated.isOpen()).toBe(true);
    expect(rehydrated.minutesLeft()).toBe(15);
  });

  it('reports the closed→open transition only once (one cookie rotation per opening)', () => {
    const breaker = makeBreaker();
    expect(breaker.recordBlock()).toBe(true); // just opened
    expect(breaker.recordBlock()).toBe(false); // still open, same user request must not re-rotate
    clock += 16 * 60 * 1000; // pause elapsed, new block reopens
    expect(breaker.recordBlock()).toBe(true);
  });
});

describe('rotateCookieJar', () => {
  let tmpDir: string;
  let jarPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-jar-'));
    jarPath = path.join(tmpDir, 'tiktok_cookies.txt');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renames the jar to .bak so yt-dlp generates a fresh one', () => {
    fs.writeFileSync(jarPath, '# Netscape HTTP Cookie File\n.tiktok.com\tTRUE\t/\tttwid\t1|xyz\n');
    expect(rotateCookieJar(jarPath)).toBe(true);
    expect(fs.existsSync(jarPath)).toBe(false);
    expect(fs.readFileSync(`${jarPath}.bak`, 'utf-8')).toContain('ttwid');
  });

  it('is a no-op when the jar does not exist yet', () => {
    expect(rotateCookieJar(jarPath)).toBe(false);
    expect(fs.existsSync(`${jarPath}.bak`)).toBe(false);
  });

  it('overwrites a stale .bak from a previous rotation', () => {
    fs.writeFileSync(`${jarPath}.bak`, 'old jar');
    fs.writeFileSync(jarPath, 'new jar');
    expect(rotateCookieJar(jarPath)).toBe(true);
    expect(fs.readFileSync(`${jarPath}.bak`, 'utf-8')).toBe('new jar');
  });
});
