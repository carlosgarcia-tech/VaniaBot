/**
 * NhentaiService.ts
 *
 * nhentai public API v2 client (verified alive 18-nov-2026) keeping the NSFW
 * doujin commands working after the dead Delirius glue.
 *
 * Real v2 shapes (checked live, the docs are unofficial):
 *  - detail  /galleries/<id> → cover.path is relative to t.nhentai.net,
 *    title is an object, tags is an array of { name }.
 *  - search  /search?query=  → items carry NO tag names and NO cover, only
 *    ids. Each candidate is resolved through the detail endpoint so the
 *    underage-tag blacklist can actually be applied before showing it.
 *
 * @author **Carlos G**
 * @created 2026-11-18
 */

import { isTagBlacklisted } from './BooruService.js';

const BASE = 'https://nhentai.net/api/v2';
const CDN = 'https://t.nhentai.net';
const TIMEOUT_MS = 20000;
/** Search candidates resolved until one passes the blacklist. */
const SEARCH_CANDIDATES = 3;
/** Extra nhentai-only markers (matched as whole words by isTagBlacklisted). */
const EXTRA_BLOCKED = ['lolicon', 'shotacon', 'lolibabu', 'toddlercon'];

export interface NhentaiGallery {
  title: string;
  coverUrl: string;
  pages: number;
}

interface ApiGallery {
  id?: number;
  blacklisted?: boolean;
  title?: { english?: string; pretty?: string; japanese?: string };
  english_title?: string;
  num_pages?: number;
  cover?: { path?: string };
  thumbnail?: { path?: string };
  tags?: Array<{ name?: string }>;
}

function isBlocked(gallery: ApiGallery): boolean {
  if (gallery.blacklisted === true) {
    return true;
  }
  const tags = (gallery.tags ?? []).map(tag => (tag.name ?? '').toLowerCase());
  if (tags.some(tag => EXTRA_BLOCKED.includes(tag))) {
    return true;
  }
  return isTagBlacklisted(tags.join(' '));
}

function toGallery(gallery: ApiGallery): NhentaiGallery | null {
  const path = gallery.cover?.path ?? gallery.thumbnail?.path;
  if (!path) {
    return null;
  }
  const title =
    gallery.title?.english ??
    gallery.title?.pretty ??
    gallery.english_title ??
    `Gallery ${gallery.id ?? '?'}`;
  return {
    title,
    coverUrl: `${CDN}/${path}`,
    pages: gallery.num_pages ?? 0,
  };
}

async function apiFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)', Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`nhentai error: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class NhentaiService {
  /** Gallery by numeric code (the id in nhentai.net/g/<id>); rejects when blacklisted. */
  async getGallery(code: string): Promise<NhentaiGallery> {
    const gallery = await apiFetch<ApiGallery>(`${BASE}/galleries/${code}`);
    if (isBlocked(gallery)) {
      throw new Error('Galería bloqueada por la lista negra de tags');
    }
    const mapped = toGallery(gallery);
    if (!mapped) {
      throw new Error('nhentai: galería sin portada');
    }
    return mapped;
  }

  /** Text search; returns the first gallery that passes the blacklist, or null. */
  async search(query: string): Promise<NhentaiGallery | null> {
    const data = await apiFetch<{ result?: ApiGallery[] }>(
      `${BASE}/search?query=${encodeURIComponent(query)}`,
    );
    const candidates = (data.result ?? [])
      .filter(item => item.id !== undefined && item.blacklisted !== true)
      .slice(0, SEARCH_CANDIDATES);

    for (const candidate of candidates) {
      try {
        const detail = await apiFetch<ApiGallery>(`${BASE}/galleries/${candidate.id}`);
        if (isBlocked(detail)) {
          continue;
        }
        const mapped = toGallery(detail);
        if (mapped) {
          return mapped;
        }
      } catch {
        // Unavailable gallery: keep looking instead of failing the search.
      }
    }
    return null;
  }
}

export const nhentaiService = new NhentaiService();
