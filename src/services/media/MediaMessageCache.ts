/**
 * MediaMessageCache.ts
 *
 * Keeps the most recent inbound media messages (full WAMessage objects, with
 * the CDN url intact) so commands can download media the user QUOTED.
 *
 * Why: WhatsApp strips the CDN url (and the thumbnailDirectPath) from quoted
 * media stubs in contextInfo, so rebuilding a synthetic message from
 * `ctx.quoted` and calling `downloadMediaMessage` fails with
 * '"imageMessage" message is not a media message'. The original message —
 * captured at reception — still has the url.
 *
 * Bounded (LRU-ish via Map insertion order) and best-effort: lookups miss
 * silently after eviction, restarts, or for media older than the cap.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import type { WAMessage } from 'baileys';
import { logError } from '@/utils/logger.js';

/** One day of a busy group is hundreds of messages; 300 covers plenty of history. */
const MAX_ENTRIES = 300;

export class MediaMessageCache {
  readonly maxSize = MAX_ENTRIES;
  private readonly store = new Map<string, WAMessage>();

  /** Caches the message when it carries image/video media. Best-effort. */
  put(message: WAMessage): void {
    try {
      const id = message.key?.id;
      const remoteJid = message.key?.remoteJid;
      if (!id || !remoteJid) return;
      const hasMedia =
        message.message?.imageMessage ||
        message.message?.videoMessage ||
        message.message?.stickerMessage;
      if (!hasMedia) return;

      const key = `${remoteJid}:${id}`;
      this.store.delete(key); // refresh insertion order
      this.store.set(key, message);

      while (this.store.size > MAX_ENTRIES) {
        const oldest = this.store.keys().next().value;
        if (oldest === undefined) break;
        this.store.delete(oldest);
      }
    } catch (error) {
      logError('[MediaMessageCache]', error);
    }
  }

  /** Original message for a quoted reference, or undefined when unknown. */
  get(remoteJid: string, messageId: string): WAMessage | undefined {
    if (!remoteJid || !messageId) return undefined;
    return this.store.get(`${remoteJid}:${messageId}`);
  }

  clear(): void {
    this.store.clear();
  }
}

export const mediaMessageCache = new MediaMessageCache();
