/**
 * MediaMessageCache.test.ts
 *
 * Quoted media stubs from contextInfo no longer carry the CDN url, so
 * sticker/IA commands can't download by rebuilding a synthetic message —
 * the cache keeps the ORIGINAL messages and resolves them by id.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mediaMessageCache } from '@/services/media/MediaMessageCache.js';

const makeMsg = (id: string, remoteJid: string) => ({
  key: { id, remoteJid, fromMe: false },
  message: { imageMessage: { url: 'https://mmg.whatsapp.net/x', mediaKey: Buffer.from('k') } },
});

describe('MediaMessageCache', () => {
  beforeEach(() => {
    mediaMessageCache.clear();
  });

  it('returns the original message by remoteJid + id', () => {
    const msg = makeMsg('ABC', 'group@g.us');
    mediaMessageCache.put(msg);

    expect(mediaMessageCache.get('group@g.us', 'ABC')).toBe(msg);
  });

  it('misses for unknown ids and drops non-media messages', () => {
    expect(mediaMessageCache.get('group@g.us', 'ABC')).toBeUndefined();

    mediaMessageCache.put({ key: { id: 'TXT', remoteJid: 'group@g.us' }, message: {} } as never);
    expect(mediaMessageCache.get('group@g.us', 'TXT')).toBeUndefined();
  });

  it('evicts the oldest entries beyond the cap', () => {
    const cap = mediaMessageCache.maxSize;
    for (let i = 0; i <= cap; i++) {
      mediaMessageCache.put(makeMsg(`id-${i}`, 'group@g.us'));
    }
    expect(mediaMessageCache.get('group@g.us', 'id-0')).toBeUndefined();
    expect(mediaMessageCache.get('group@g.us', `id-${cap}`)).toBeDefined();
  });
});
