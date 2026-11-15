import fs from 'fs';
import path from 'path';
import { logError, logger } from '@/utils/logger.js';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

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

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

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

/**
 * File cache for downloaded TikTok media, keyed by video id, inside a
 * persistent directory (/app/data/tiktok_cache in production — the
 * orbit_database volume — so cached items survive container restarts).
 * TTL by file mtime; total-size limit with oldest-first eviction.
 */
export class TikTokFileCache {
  private readonly dir: string;
  private readonly ttlMs: number;
  private readonly maxTotalBytes: number;
  private readonly now: () => number;

  constructor(options: {
    dir: string;
    ttlMs?: number;
    maxTotalBytes?: number;
    now?: () => number;
  }) {
    this.dir = options.dir;
    this.ttlMs = options.ttlMs ?? 6 * 60 * 60 * 1000;
    this.maxTotalBytes = options.maxTotalBytes ?? 500 * 1024 * 1024;
    this.now = options.now ?? Date.now;
  }

  /** Directory the cache stores into (also used to identify cached files). */
  get directory(): string {
    return this.dir;
  }

  /** Cached file path for the video id, or null on miss/TTL/expiry. */
  get(videoId: string): string | null {
    const file = this.pathFor(videoId);
    try {
      const stats = fs.statSync(file);
      if (this.now() - stats.mtimeMs > this.ttlMs) return null;
      return file;
    } catch {
      return null;
    }
  }

  /** Moves a freshly downloaded file into the cache and evicts if needed. */
  store(videoId: string, sourcePath: string): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const target = this.pathFor(videoId);
      try {
        fs.renameSync(sourcePath, target);
      } catch (error) {
        // Different filesystems (e.g. tests with a tmpdir cache) cannot rename.
        if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
          fs.copyFileSync(sourcePath, target);
          fs.unlinkSync(sourcePath);
        } else {
          throw error;
        }
      }
      // Preserve the original download time for TTL purposes.
      const nowMs = this.now();
      fs.utimesSync(target, nowMs / 1000, nowMs / 1000);
      this.evictIfNeeded(target);
    } catch (error) {
      // Cache is best-effort: a failed store leaves the download usable.
      logError('TikTokFileCache.store', error);
    }
  }

  private pathFor(videoId: string): string {
    return path.join(this.dir, videoId);
  }

  private evictIfNeeded(protectedPath: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.dir, { withFileTypes: true });
    } catch {
      return;
    }
    const files = entries
      .filter(e => e.isFile())
      .map(e => {
        const file = path.join(this.dir, e.name);
        try {
          return { file, size: fs.statSync(file).size, mtime: fs.statSync(file).mtimeMs };
        } catch {
          return { file, size: 0, mtime: 0 };
        }
      });
    let total = files.reduce((sum, f) => sum + f.size, 0);
    if (total <= this.maxTotalBytes) return;
    const deletable = files.filter(f => f.file !== protectedPath).sort((a, b) => a.mtime - b.mtime);
    for (const entry of deletable) {
      if (total <= this.maxTotalBytes) break;
      try {
        fs.unlinkSync(entry.file);
        total -= entry.size;
      } catch {
        // already gone; keep evicting
      }
    }
  }
}

/**
 * In-flight promise dedupe: concurrent calls with the same key share one
 * execution (the same video requested twice at the same time must produce
 * at most one yt-dlp run). Failures are not cached.
 */
export function createInFlightDedupe(): <T>(key: string, fn: () => Promise<T>) => Promise<T> {
  const inFlight = new Map<string, Promise<unknown>>();
  return <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = fn().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}

/**
 * Block detection from real yt-dlp stderr strings (see
 * docs/TIKTOK_403_DEBUG.md). DNS failures and unsupported URLs are NOT
 * blocks — they do not mean the IP's reputation is damaged.
 */
const TIKTOK_BLOCK_PATTERNS: RegExp[] = [
  /HTTP Error 403/i,
  /Your IP address is blocked/i,
  /Unexpected response from webpage request/i,
];

export function isTikTokBlockError(message: string): boolean {
  return TIKTOK_BLOCK_PATTERNS.some(pattern => pattern.test(message));
}

/** Persisted breaker state — survives container restarts via JsonFileStore. */
export interface TikTokBreakerState {
  /** Absolute ms timestamp until which the breaker stays open (0 = closed). */
  openUntil: number;
  /** Consecutive blocks since the last success; 0 = backoff at base. */
  backoffLevel: number;
}

/**
 * Persistent circuit breaker for TikTok: a confirmed block stops all yt-dlp
 * TikTok calls for `base` minutes, doubling on each reopened block up to
 * `max`; a success resets the backoff. State lives in /app/data so a
 * redeploy does not immediately reopen traffic against a flagged IP.
 */
export class TikTokBreaker {
  private readonly store: JsonFileStore<TikTokBreakerState>;
  private readonly baseMinMs: number;
  private readonly maxMinMs: number;
  private readonly now: () => number;

  constructor(options: {
    store: JsonFileStore<TikTokBreakerState>;
    baseMinMs?: number;
    maxMinMs?: number;
    now?: () => number;
  }) {
    this.store = options.store;
    this.baseMinMs = options.baseMinMs ?? 15 * 60 * 1000;
    this.maxMinMs = options.maxMinMs ?? 120 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  isOpen(): boolean {
    return this.load().openUntil > this.now();
  }

  /** Whole minutes left until the breaker reopens (0 when closed). */
  minutesLeft(): number {
    const openUntil = this.load().openUntil;
    if (openUntil <= this.now()) return 0;
    return Math.max(1, Math.ceil((openUntil - this.now()) / 60000));
  }

  /**
   * Registers a confirmed block. No-ops while the breaker is already open so
   * one user request (which may fail in several internal methods) cannot
   * open it twice. Returns true only on the closed→open transition — the
   * caller uses it to rotate the cookie jar once per opening.
   */
  recordBlock(reason?: string): boolean {
    const state = this.load();
    if (state.openUntil > this.now()) return false;

    const level = Math.min(state.backoffLevel + 1, this.backoffCap());
    const pauseMs = Math.min(this.baseMinMs * 2 ** (level - 1), this.maxMinMs);
    const openUntil = this.now() + pauseMs;
    this.store.save({ openUntil, backoffLevel: level });
    logError(
      'TikTokBreaker',
      new Error(
        `TikTok block detected — breaker OPEN for ${Math.round(pauseMs / 60000)} min ` +
          `(level ${level})${reason ? `: ${reason.slice(0, 300)}` : ''}`,
      ),
    );
    return true;
  }

  /** Registers a successful download: closes the breaker and resets backoff. */
  recordSuccess(): void {
    const state = this.load();
    if (state.openUntil === 0 && state.backoffLevel === 0) return;
    this.store.save({ openUntil: 0, backoffLevel: 0 });
    logger.info('[TikTokBreaker] Success — breaker CLOSED, backoff reset');
  }

  /** 2^(level-1) capped so that base * 2^(cap-1) == max. */
  private backoffCap(): number {
    return Math.max(1, Math.round(Math.log2(this.maxMinMs / this.baseMinMs)) + 1);
  }

  private load(): TikTokBreakerState {
    return this.store.load();
  }
}

/**
 * Rotates the yt-dlp cookie jar to `<jar>.bak` so the next run generates a
 * fresh session. Called once per breaker opening (a flagged IP taints the
 * session's ttwid reputation). The jar is only written by yt-dlp itself.
 */
export function rotateCookieJar(jarPath: string): boolean {
  if (!fs.existsSync(jarPath)) return false;
  try {
    fs.renameSync(jarPath, `${jarPath}.bak`); // rename replaces a stale .bak
    logger.info(`[TikTokGuard] Cookie jar rotated to ${jarPath}.bak`);
    return true;
  } catch (error) {
    logError('TikTokGuard.rotateCookieJar', error);
    return false;
  }
}

/**
 * Parses `yt-dlp --list-impersonate-targets` output: the first column of
 * each AVAILABLE target line. Headers (uppercase words) and unavailable
 * targets (✗) are dropped.
 */
export function parseImpersonateTargets(output: string): string[] {
  const targets: string[] = [];
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.includes('✗') || /not available/i.test(line)) continue;
    const token = /^\S+/.exec(line)?.[0] ?? '';
    // Only lowercase identifiers are target names; headers start uppercase.
    if (!/^[a-z][a-z0-9_.-]*$/.test(token)) continue;
    targets.push(token);
  }
  return targets;
}

/** Family order required by the plan: chrome, safari, firefox, edge. */
const IMPERSONATE_FAMILY_ORDER = ['chrome', 'safari', 'firefox', 'edge'] as const;

/**
 * Builds the retry rotation list from the targets this installation really
 * has (never assumes names). Exact bases first (chrome), then variants in
 * alphabetical order, families in plan order.
 */
export function buildImpersonateCandidates(targets: string[]): string[] {
  const candidates: string[] = [];
  for (const family of IMPERSONATE_FAMILY_ORDER) {
    const inFamily = targets.filter(t => t.startsWith(family));
    if (inFamily.length === 0) continue;
    const exact = inFamily.filter(t => t === family);
    const variants = inFamily.filter(t => t !== family).sort();
    candidates.push(...exact, ...variants);
  }
  return candidates;
}

/** Per-invocation network family flag (TIKTOK_IP_FAMILY). */
export function ipFamilyArgs(family: 'auto' | '4' | '6'): string[] {
  if (family === '4') return ['-4'];
  if (family === '6') return ['--force-ipv6'];
  return [];
}

/** Last-resort mobile API fallback (tried once after web retries fail). */
export function mobileApiArgs(): string[] {
  return ['--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com'];
}

/** Friendly rejection shown to users while the breaker is open. */
export class TikTokBlockedError extends Error {
  readonly minutes: number;

  constructor(minutes: number) {
    super(
      `TikTok limitó temporalmente las descargas desde este servidor. ` +
        `Intenta de nuevo en ~${minutes} min.`,
    );
    this.name = 'TikTokBlockedError';
    this.minutes = minutes;
  }
}

/** Env parsing with the plan's defaults; invalid/absent values fall back. */
function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Orchestrates every yt-dlp TikTok call through the guard: canonical URL
 * memo, serial queue with minimum gap, per-video file cache, in-flight
 * dedupe, persistent breaker and impersonation-target rotation. TikTok
 * callers inject the actual exec function, so the whole policy is testable
 * without touching the network.
 */
export class TikTokGuardService {
  private readonly queue: TikTokQueue;
  private readonly cache: TikTokFileCache;
  private readonly breaker: TikTokBreaker;
  private readonly dedupe = createInFlightDedupe();
  private readonly runYtDlp: (args: string[], timeout: number) => Promise<string>;
  private readonly cookiesPath: string;
  private readonly ipFamily: 'auto' | '4' | '6';
  private readonly now: () => number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly retryDelayMs: () => number;

  /** Impersonation targets from this installation; null = not queried yet. */
  private targets: string[] | null = null;
  private readonly canonicalMemo = new Map<string, { value: string; ts: number }>();

  constructor(options: {
    runYtDlp: (args: string[], timeout: number) => Promise<string>;
    cacheDir?: string;
    cookiesPath?: string;
    breakerPath?: string;
    minGapMs?: number;
    jitterMs?: number;
    maxWaitMs?: number;
    ttlMs?: number;
    maxTotalBytes?: number;
    baseMinMs?: number;
    maxMinMs?: number;
    ipFamily?: 'auto' | '4' | '6';
    retryDelayMs?: () => number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
    fetchImpl?: typeof fetch;
  }) {
    const now = options.now ?? Date.now;
    this.runYtDlp = options.runYtDlp;
    this.cookiesPath = options.cookiesPath ?? './data/tiktok_cookies.txt';
    this.ipFamily = options.ipFamily ?? 'auto';
    this.now = now;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    // Plan: 5-10s between retries of the same download.
    this.retryDelayMs = options.retryDelayMs ?? (() => 5000 + Math.floor(Math.random() * 5001));
    this.queue = new TikTokQueue({
      minGapMs: options.minGapMs ?? envNumber('TIKTOK_MIN_GAP_MS', 15000),
      jitterMs: options.jitterMs ?? envNumber('TIKTOK_JITTER_MS', 5000),
      maxWaitMs: options.maxWaitMs ?? 180000,
      now,
      sleep: options.sleep,
      random: options.random,
    });
    this.cache = new TikTokFileCache({
      dir: options.cacheDir ?? './data/tiktok_cache',
      ttlMs: options.ttlMs ?? envNumber('TIKTOK_CACHE_TTL_MS', 6 * 60 * 60 * 1000),
      maxTotalBytes: options.maxTotalBytes ?? envNumber('TIKTOK_CACHE_MAX_MB', 500) * 1024 * 1024,
      now,
    });
    this.breaker = new TikTokBreaker({
      store: new JsonFileStore<TikTokBreakerState>({
        filePath: options.breakerPath ?? './data/tiktok_breaker.json',
        defaults: () => ({ openUntil: 0, backoffLevel: 0 }),
      }),
      baseMinMs: options.baseMinMs ?? envNumber('TIKTOK_BREAKER_BASE_MIN', 15) * 60 * 1000,
      maxMinMs: options.maxMinMs ?? envNumber('TIKTOK_BREAKER_MAX_MIN', 120) * 60 * 1000,
      now,
    });
  }

  /** Canonical URL, memoized per original short link (one redirect per URL). */
  async canonical(url: string): Promise<string> {
    const memo = this.canonicalMemo.get(url);
    if (memo && this.now() - memo.ts < 10 * 60 * 1000) return memo.value;
    const value = await this.dedupe(`canonical:${url}`, () =>
      resolveCanonicalUrl(url, this.fetchImpl),
    );
    this.canonicalMemo.set(url, { value, ts: this.now() });
    return value;
  }

  isBlocked(): boolean {
    return this.breaker.isOpen();
  }

  blockedMinutesLeft(): number {
    return this.breaker.minutesLeft();
  }

  /** Per-invocation yt-dlp args shared by every TikTok call. */
  buildBaseArgs(impersonateTarget?: string): string[] {
    const target =
      impersonateTarget ?? (this.targets === null ? 'chrome' : this.targets[0] || undefined);
    return [
      '--cookies',
      this.cookiesPath,
      '--extractor-retries',
      '0',
      ...(target ? ['--impersonate', target] : []),
      ...ipFamilyArgs(this.ipFamily),
    ];
  }

  /**
   * Impersonation target for a retry attempt, from the targets this
   * installation really lists (queried once, then cached). undefined when
   * the list is empty or the attempt exceeds the candidates.
   */
  async impersonateTargetFor(attempt: number): Promise<string | undefined> {
    if (this.targets === null) {
      try {
        this.targets = parseImpersonateTargets(
          await this.runYtDlp(['--list-impersonate-targets'], 15000),
        );
      } catch (error) {
        this.targets = [];
        logError('TikTokGuardService.impersonateTargetFor', error);
      }
    }
    return buildImpersonateCandidates(this.targets)[attempt];
  }

  /**
   * Runs one yt-dlp call through the guard: refuses while the breaker is
   * open, dedupes concurrent identical calls (same key) and serializes
   * everything through the minimum-gap queue.
   */
  async guardRun<T>(key: string, task: () => Promise<T>): Promise<T> {
    if (this.breaker.isOpen()) {
      throw new TikTokBlockedError(this.breaker.minutesLeft());
    }
    return this.dedupe(key, () => this.queue.enqueue(task));
  }

  /** Classifies a yt-dlp stderr: confirmed blocks open the breaker (and rotate the jar once per opening). */
  handleFailure(stderr: string): void {
    if (!isTikTokBlockError(stderr)) return;
    if (this.breaker.recordBlock(stderr)) {
      rotateCookieJar(this.cookiesPath);
    }
  }

  /** A successful download resets the breaker. */
  handleSuccess(): void {
    this.breaker.recordSuccess();
  }

  /** Wait between retries of the same download (plan: 5-10s). */
  async retryDelay(): Promise<void> {
    await this.sleep(this.retryDelayMs());
  }

  serveFromCache(videoId: string): string | null {
    return this.cache.get(videoId);
  }

  storeInCache(videoId: string, sourcePath: string): void {
    this.cache.store(videoId, sourcePath);
  }

  /** True for files living inside the cache dir (never delete those). */
  ownsCachedFile(filePath: string): boolean {
    return filePath.startsWith(this.cache.directory + path.sep);
  }
}
