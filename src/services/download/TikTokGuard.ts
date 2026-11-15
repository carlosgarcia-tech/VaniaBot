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
