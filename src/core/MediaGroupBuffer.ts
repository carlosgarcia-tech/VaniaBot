import type { WAMessage } from 'baileys';

const BUFFER_TTL_MS = 25_000;

interface BufferedItem {
  message: WAMessage;
  timestamp: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Buffers media group messages to handle album-style messages as a single unit.
 * Implements singleton pattern for global access.
 */
export class MediaGroupBuffer {
  private static instance: MediaGroupBuffer;
  private buffers = new Map<string, BufferedItem[]>();
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
    // Cleanup-only timer: must not keep the process alive on shutdown.
    this.cleanupInterval.unref();
  }

  /**
   * Gets the singleton instance of MediaGroupBuffer.
   *
   * @returns The MediaGroupBuffer instance.
   */
  static getInstance(): MediaGroupBuffer {
    if (!MediaGroupBuffer.instance) {
      MediaGroupBuffer.instance = new MediaGroupBuffer();
    }
    return MediaGroupBuffer.instance;
  }

  /**
   * Generates a unique key for a chat/sender combination.
   *
   * @param chatJid - The chat JID.
   * @param senderJid - The sender JID.
   * @returns A unique key string.
   */
  private key(chatJid: string, senderJid: string): string {
    return `${chatJid}:${senderJid}`;
  }

  /**
   * Adds a message to the buffer.
   *
   * @param chatJid - The chat JID.
   * @param senderJid - The sender JID.
   * @param message - The WhatsApp message to buffer.
   */
  add(chatJid: string, senderJid: string, message: WAMessage): void {
    if (!chatJid || !senderJid) return;
    const k = this.key(chatJid, senderJid);
    const list = this.buffers.get(k) ?? [];
    list.push({ message, timestamp: Date.now() });
    this.buffers.set(k, list);
  }

  /**
   * Checks if there are any buffered messages for a chat/sender.
   *
   * @param chatJid - The chat JID.
   * @param senderJid - The sender JID.
   * @returns True if there are buffered messages.
   */
  hasAny(chatJid: string, senderJid: string): boolean {
    const list = this.buffers.get(this.key(chatJid, senderJid));
    return !!list && list.length > 0;
  }

  /**
   * Consumes and removes all buffered messages for a chat/sender.
   * Deduplicates by message ID and sorts by timestamp.
   *
   * @param chatJid - The chat JID.
   * @param senderJid - The sender JID.
   * @returns An array of consumed messages.
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
   * Waits for media group to settle, then consumes all messages.
   * Waits until no new messages arrive for settleMs, up to maxWaitMs.
   *
   * @param chatJid - The chat JID.
   * @param senderJid - The sender JID.
   * @param settleMs - Time to wait after last message (default: 1200ms).
   * @param maxWaitMs - Maximum total wait time (default: 6000ms).
   * @returns A promise that resolves to the consumed messages.
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
   * Removes expired buffers based on TTL.
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

  /**
   * Stops the cleanup interval.
   * Should be called on application shutdown.
   */
  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const mediaGroupBuffer = MediaGroupBuffer.getInstance();