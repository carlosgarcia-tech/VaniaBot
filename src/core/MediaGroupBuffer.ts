import type { WAMessage } from 'baileys';

const BUFFER_TTL_MS = 25_000;

interface BufferedItem {
  message: WAMessage;
  timestamp: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MediaGroupBuffer {
  private static instance: MediaGroupBuffer;
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

  add(chatJid: string, senderJid: string, message: WAMessage): void {
    if (!chatJid || !senderJid) return;
    const k = this.key(chatJid, senderJid);
    const list = this.buffers.get(k) ?? [];
    list.push({ message, timestamp: Date.now() });
    this.buffers.set(k, list);
  }

  hasAny(chatJid: string, senderJid: string): boolean {
    const list = this.buffers.get(this.key(chatJid, senderJid));
    return !!list && list.length > 0;
  }

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

  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const mediaGroupBuffer = MediaGroupBuffer.getInstance();
