/**
 * SpotifyService.ts
 *
 * Free Spotify helpers after the Web API dropped its free tier (2026):
 *  - metadata via the public oEmbed endpoint (no key, verified alive),
 *  - album/playlist track lists scraped from the embed page (__NEXT_DATA__),
 *  - audio download by searching the oEmbed title on YouTube with the
 *    shared yt-dlp pipeline (`ytsearch1:`).
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { ytDlpDownloader } from '@/services/download/YtDlpDownloader.js';
import type { DownloadResult } from '@/services/download/DownloadService.js';

const TIMEOUT_MS = 15000;

export interface SpotifyTrackInfo {
  title: string;
  thumbnailUrl?: string;
}

export interface SpotifyTrack {
  title: string;
  artist: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)', Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`spotify error: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractSpotifyId(url: string): string | null {
  const match = url.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/,
  );
  return match ? match[2] : null;
}

export class SpotifyService {
  /** oEmbed metadata for any spotify entity url. */
  async getTrackInfo(url: string): Promise<SpotifyTrackInfo> {
    const id = extractSpotifyId(url);
    if (!id) throw new Error('URL de Spotify inválida');

    const data = await fetchJson<{ title?: string; thumbnail_url?: string }>(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`,
    );
    if (!data.title) {
      throw new Error('spotify oEmbed: sin título');
    }
    return { title: data.title, thumbnailUrl: data.thumbnail_url };
  }

  /** Track → mp3 via oEmbed title + YouTube search through yt-dlp. */
  async downloadTrack(url: string): Promise<DownloadResult> {
    const { title } = await this.getTrackInfo(url);
    return await ytDlpDownloader.downloadAudio(`ytsearch1:${title}`);
  }

  /** Album/playlist track list from the embed page (max 20). */
  async getTrackList(url: string): Promise<SpotifyTrack[]> {
    const id = extractSpotifyId(url);
    if (!id) throw new Error('URL de Spotify inválida');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let html: string;
    try {
      const response = await fetch(`https://open.spotify.com/embed/album/${id}`, {
        headers: { 'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`spotify embed error: ${response.status}`);
      }
      html = await response.text();
    } finally {
      clearTimeout(timeoutId);
    }

    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
    );
    if (!match) {
      throw new Error('spotify embed: sin datos');
    }
    const parsed = JSON.parse(match[1]) as unknown;
    const trackList = this.findTrackList(parsed);
    if (!trackList?.length) {
      throw new Error('spotify embed: sin trackList');
    }
    return trackList.slice(0, 20).map(t => ({ title: t.title ?? '?', artist: t.subtitle ?? '?' }));
  }

  private findTrackList(
    node: unknown,
    depth = 0,
  ): Array<{ title?: string; subtitle?: string }> | null {
    if (depth > 12 || !node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.findTrackList(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.trackList)) {
      return record.trackList as Array<{ title?: string; subtitle?: string }>;
    }
    for (const value of Object.values(record)) {
      const found = this.findTrackList(value, depth + 1);
      if (found) return found;
    }
    return null;
  }
}

export const spotifyService = new SpotifyService();
