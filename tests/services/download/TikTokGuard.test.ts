import { describe, it, expect } from 'vitest';
import {
  extractVideoId,
  isCanonicalTikTokUrl,
  cleanCanonicalUrl,
  resolveCanonicalUrl,
} from '../../../src/services/download/TikTokGuard.js';

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
