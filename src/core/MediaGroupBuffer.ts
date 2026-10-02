/**
 * MediaGroupBuffer.ts
 *
 * Regroups the individual media messages of an album into a single batch.
 *
 * WhatsApp delivers a multi-image/media album as several separate messages that
 * arrive within a short, unpredictable window and carry no album identifier the
 * bot can rely on. This buffer accumulates them per (chat, sender) pair and
 * exposes a settle-based drain: wait until the batch stops growing, then hand
 * back the whole group ordered and de-duplicated.
 *
 * Singleton because buffering is process-wide state shared by every command
 * that consumes albums.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { WAMessage } from 'baileys';

/** Hard expiry for buffered items, independent of any in-flight drain. */
const BUFFER_TTL_MS = 25_000;

/** One buffered media message plus its arrival time (used for ordering/TTL). */
interface BufferedItem {
  message: WAMessage;
  timestamp: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MediaGroupBuffer {
  private static instance: MediaGroupBuffer;
  /** In-flight batches, keyed by `${chatJid}:${senderJid}`. */
  private buffers = new Map<string, BufferedItem[]>();
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
    // Cleanup-only timer: must not keep the process alive on shutdown.
    this.cleanupInterval.unref();
  }

  static getInstance(): MediaGroupBuffer {
    if (!MediaGroupBuffer.instance) {
      MediaGroupBuffer.instance = new MediaGroupBuffer();
    }
    return MediaGroupBuffer.instance;
  }

  private key(chatJid: string, senderJid: string): string {
    return `${chatJid}:${senderJid}`;
  }

  /**
   * Appends a media message to its sender's batch.
   * Missing chat/sender identifiers are ignored because the batch key would be
   * unusable and would leak a permanently unconsumable entry.
   */
  add(chatJid: string, senderJid: string, message: WAMessage): void {
    if (!chatJid || !senderJid) return;
    const k = this.key(chatJid, senderJid);
    const list = this.buffers.get(k) ?? [];
    list.push({ message, timestamp: Date.now() });
    this.buffers.set(k, list);
  }

  /** True when this sender has buffered media awaiting a drain. */
  hasAny(chatJid: string, senderJid: string): boolean {
    const list = this.buffers.get(this.key(chatJid, senderJid));
    return !!list && list.length > 0;
  }

  /**
   * Drains and removes the batch, discarding duplicate message IDs (the same
   * album can be re-delivered after a reconnect) and restoring arrival order.
   */
  private consume(chatJid: string, senderJid: string): WAMessage[] {
    const k = this.key(chatJid, senderJid);
    const list = this.buffers.get(k) ?? [];
    this.buffers.delete(k);

    const seen = new Set<string>();
    return list
      .filter(item => {
        const id = item.message.key.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => item.message);
  }

  /**
   * Waits for the batch to settle, then consumes it.
   *
   * Polls every `settleMs` and stops as soon as two consecutive observations
   * report the same size (i.e. no new album item arrived), or after
   * `maxWaitMs` regardless, so a continuously growing stream cannot stall a
   * caller indefinitely.
   *
   * @param settleMs Delay between size observations.
   * @param maxWaitMs Absolute ceiling on the total wait.
   */
  async waitAndConsume(
    chatJid: string,
    senderJid: string,
    settleMs = 1200,
    maxWaitMs = 6000,
  ): Promise<WAMessage[]> {
    const k = this.key(chatJid, senderJid);
    const start = Date.now();
    let lastSize = -1;

    while (Date.now() - start < maxWaitMs) {
      const currentSize = this.buffers.get(k)?.length ?? 0;
      if (currentSize === 0 && lastSize <= 0) {
        break;
      }
      if (currentSize === lastSize) {
        break;
      }
      lastSize = currentSize;
      await sleep(settleMs);
    }

    return this.consume(chatJid, senderJid);
  }

  /**
   * Periodic sweep dropping items older than BUFFER_TTL_MS, so batches whose
   * consumer never ran (abandoned command, crashed handler) do not leak memory.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, list] of this.buffers.entries()) {
      const filtered = list.filter(item => now - item.timestamp <= BUFFER_TTL_MS);
      if (filtered.length === 0) {
        this.buffers.delete(key);
      } else {
        this.buffers.set(key, filtered);
      }
    }
  }

  /** Clears the cleanup timer. Buffered batches are intentionally left to expire. */
  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const mediaGroupBuffer = MediaGroupBuffer.getInstance();
