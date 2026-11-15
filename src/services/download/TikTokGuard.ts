/**
 * TikTokGuard.ts
 *
 * Anti-block guard for TikTok downloads: URL canonicalization, a serial
 * queue with a minimum gap (TikTok rate-limits bursts from one IP), a
 * per-video file cache, a persistent circuit breaker, and yt-dlp
 * impersonation-target rotation.
 *
 * All primitives (fetch, file system paths, timers) are injectable so the
 * whole thing is testable without touching the network.
 *
 * @author **Carlos G**
 * @created 2026-11-15
 */

/** True for https://www.tiktok.com/@user/video|photo/<digits>. */
export function isCanonicalTikTokUrl(url: string): boolean {
  return /^https?:\/\/(www\.|m\.)?tiktok\.com\/@[^/]+\/(video|photo)\/\d+/i.test(url);
}

/**
 * Strips query string and fragment from a canonical TikTok URL.
 * Returns null when the URL is not canonical (short links, foreign hosts).
 */
export function cleanCanonicalUrl(url: string): string | null {
  if (!isCanonicalTikTokUrl(url)) return null;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extracts the numeric video id from a canonical TikTok URL.
 * Short links (vt./vm.tiktok.com) carry no id — returns null there.
 */
export function extractVideoId(url: string): string | null {
  const match = /tiktok\.com\/@[^/]+\/(?:video|photo)\/(\d+)/i.exec(url);
  if (!match) return null;
  return /^\d+$/.test(match[1]) ? match[1] : null;
}

/**
 * Resolves a TikTok URL to its canonical form:
 * - canonical URLs are cleaned in place (no network);
 * - short links (vt./vm.tiktok.com) are resolved with ONE lightweight
 *   redirect-following request, then cleaned;
 * - on any failure the original URL is returned so the download can still
 *   be attempted by yt-dlp.
 */
export async function resolveCanonicalUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const cleaned = cleanCanonicalUrl(url);
  if (cleaned) return cleaned;

  if (!/^https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url)) return url;

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      },
    });
    const finalUrl = response.url ?? url;
    return cleanCanonicalUrl(finalUrl) ?? url;
  } catch {
    return url;
  }
}

/**
 * Serial FIFO queue with a minimum gap between task starts: TikTok
 * rate-limits bursts of requests from a single IP, so at most ONE yt-dlp
 * invocation runs at a time and new ones start at least
 * `minGapMs + random(0..jitterMs)` after the previous start.
 */
export class TikTokQueueTimeoutError extends Error {
  constructor(waitedMs: number, maxWaitMs: number) {
    super(
      `La cola de descargas de TikTok está congestionada (esperaste ${Math.round(
        waitedMs / 1000,
      )}s de ${Math.round(maxWaitMs / 1000)}s máximo). Intenta de nuevo en un momento.`,
    );
    this.name = 'TikTokQueueTimeoutError';
  }
}

export interface TikTokQueueOptions {
  /** Minimum milliseconds between two task starts (default 15000). */
  minGapMs?: number;
  /** Extra random 0..jitterMs added to the gap (default 5000). */
  jitterMs?: number;
  /** Reject tasks whose estimated start delay exceeds this (default 180000). */
  maxWaitMs?: number;
  random?: () => number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export class TikTokQueue {
  private readonly minGapMs: number;
  private readonly jitterMs: number;
  private readonly maxWaitMs: number;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** Tail of the execution chain; keeps FIFO order and concurrency 1. */
  private chain: Promise<void> = Promise.resolve();
  private lastStartAt: number | null = null;
  private waiting = 0;

  constructor(options: TikTokQueueOptions = {}) {
    this.minGapMs = options.minGapMs ?? 15000;
    this.jitterMs = options.jitterMs ?? 5000;
    this.maxWaitMs = options.maxWaitMs ?? 180000;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /** Seconds until the next slot opens (for user-facing messages). */
  secondsUntilNextSlot(): number {
    if (this.waiting === 0 || this.lastStartAt === null) return 0;
    const elapsed = this.now() - this.lastStartAt;
    return Math.max(0, Math.ceil((this.minGapMs - elapsed) / 1000));
  }

  async enqueue<T>(
    task: () => Promise<T>,
    opts: { onQueued?: (position: number) => void } = {},
  ): Promise<T> {
    const enqueuedAt = this.now();
    this.waiting++;
    opts.onQueued?.(this.waiting);

    const run = async (): Promise<T> => {
      this.waiting--;
      const elapsedSinceStart =
        this.lastStartAt === null ? Infinity : this.now() - this.lastStartAt;
      const gap = this.minGapMs + Math.floor(this.random() * this.jitterMs);
      const delay = Math.max(0, gap - elapsedSinceStart);
      const waited = this.now() - enqueuedAt;
      if (waited + delay > this.maxWaitMs) {
        throw new TikTokQueueTimeoutError(waited, this.maxWaitMs);
      }
      if (delay > 0) {
        await this.sleep(delay);
      }
      this.lastStartAt = this.now();
      return task();
    };

    const result = this.chain.then(run, run);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
