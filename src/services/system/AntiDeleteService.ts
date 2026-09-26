import type { WASocket } from 'baileys';
import { downloadContentFromMessage } from 'baileys';
import type { proto } from 'baileys';
import fs from 'fs';
import path from 'path';
import { logError } from '@/utils/logger.js';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

export interface StoredMessage {
  id: string;
  content: string;
  mediaType?: 'image' | 'video' | 'audio' | 'sticker';
  mediaBuffer?: Buffer;
  sender: string;
  senderName?: string;
  groupJid?: string;
  timestamp: number;
}

export interface AntiDeleteConfig {
  enabled: boolean;
  groups: Record<string, boolean>;
}

function validateAntiDeleteConfig(data: unknown): AntiDeleteConfig {
  const raw = (data ?? {}) as Record<string, unknown>;
  const groups: Record<string, boolean> = {};
  if (typeof raw.groups === 'object' && raw.groups !== null && !Array.isArray(raw.groups)) {
    for (const [key, value] of Object.entries(raw.groups)) {
      if (typeof value === 'boolean') groups[key] = value;
    }
  }
  return {
    enabled: raw.enabled === true,
    groups,
  };
}

export class AntiDeleteService {
  private static instance: AntiDeleteService;
  private messageStore = new Map<string, StoredMessage>();
  private config: AntiDeleteConfig;
  private readonly TMP_DIR = path.join(process.cwd(), 'tmp', 'antidelete');
  private readonly MAX_MESSAGE_AGE = 24 * 60 * 60 * 1000;
  /** Hard cap on stored entries to prevent unbounded RAM growth. */
  private readonly MAX_STORED_MESSAGES = 500;
  /** Messages bigger than this are stored as metadata only (no buffer). */
  private readonly MAX_MEDIA_BUFFER_BYTES = 8 * 1024 * 1024;
  /**
   * Atomic file-backed store for the anti-delete config. Replaces the
   * previous plain writeFileSync, which could corrupt the file on a
   * crash mid-write.
   */
  private readonly configStore = new JsonFileStore<AntiDeleteConfig>({
    filePath: path.join(process.cwd(), 'data', 'antidelete.json'),
    defaults: () => ({ enabled: false, groups: {} }),
    validate: validateAntiDeleteConfig,
  });

  constructor() {
    this.ensureTmpDir();
    this.config = this.configStore.load();
    this.startCleanupTimer();
  }

  static getInstance(): AntiDeleteService {
    if (!AntiDeleteService.instance) {
      AntiDeleteService.instance = new AntiDeleteService();
    }
    return AntiDeleteService.instance;
  }

  private ensureTmpDir(): void {
    if (!fs.existsSync(this.TMP_DIR)) {
      fs.mkdirSync(this.TMP_DIR, { recursive: true });
    }
  }

  private startCleanupTimer(): void {
    setInterval(
      () => {
        this.cleanup();
      },
      60 * 60 * 1000,
    );
    // Note: unref'd callers may rely on this interval; keep default behavior.
  }

  /** Drops the oldest entries when the store exceeds its cap. */
  private enforceStoreLimit(): void {
    while (this.messageStore.size > this.MAX_STORED_MESSAGES) {
      const oldestKey = this.messageStore.keys().next().value;
      if (oldestKey === undefined) break;
      this.messageStore.delete(oldestKey);
    }
  }

  isEnabled(groupJid?: string): boolean {
    if (groupJid) {
      return this.config.enabled && this.config.groups[groupJid] !== false;
    }
    return this.config.enabled;
  }

  enable(groupJid?: string): void {
    if (groupJid) {
      this.config.groups[groupJid] = true;
    } else {
      this.config.enabled = true;
    }
    this.saveConfig();
  }

  disable(groupJid?: string): void {
    if (groupJid) {
      this.config.groups[groupJid] = false;
    } else {
      this.config.enabled = false;
    }
    this.saveConfig();
  }

  getConfig(): AntiDeleteConfig {
    return this.config;
  }

  async storeMessage(sock: WASocket, message: proto.IWebMessageInfo): Promise<void> {
    const groupJid = message.key?.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined;

    if (groupJid && !this.isEnabled(groupJid)) return;
    if (!this.isEnabled() && !groupJid) return;

    const messageId = message.key?.id;
    if (!messageId) return;

    const sender = message.key?.participant || message.key?.remoteJid || '';
    const senderName = message.pushName || sender.split('@')[0];

    let content = '';
    let mediaType: StoredMessage['mediaType'] | undefined;
    let mediaBuffer: Buffer | undefined;

    if (message.message?.conversation) {
      content = message.message.conversation;
    } else if (message.message?.extendedTextMessage?.text) {
      content = message.message.extendedTextMessage.text;
    } else if (message.message?.imageMessage) {
      mediaType = 'image';
      content = message.message.imageMessage.caption || '';
      mediaBuffer = await this.downloadMediaBuffer(message.message.imageMessage, 'image');
    } else if (message.message?.videoMessage) {
      mediaType = 'video';
      content = message.message.videoMessage.caption || '';
      // Videos can be huge; skip buffering them entirely to protect RAM.
    } else if (message.message?.stickerMessage) {
      mediaType = 'sticker';
      mediaBuffer = await this.downloadMediaBuffer(message.message.stickerMessage, 'sticker');
    } else if (message.message?.audioMessage) {
      mediaType = 'audio';
      mediaBuffer = await this.downloadMediaBuffer(message.message.audioMessage, 'audio');
    }

    const stored: StoredMessage = {
      id: messageId,
      content,
      mediaType,
      mediaBuffer,
      sender,
      senderName,
      groupJid,
      timestamp: Date.now(),
    };

    this.messageStore.set(messageId, stored);
    this.enforceStoreLimit();
  }

  /**
   * Downloads media content up to MAX_MEDIA_BUFFER_BYTES; larger media is
   * stored as metadata only. Returns undefined on any failure — storing
   * media is best-effort.
   */
  private async downloadMediaBuffer(
    content: unknown,
    type: 'image' | 'sticker' | 'audio',
  ): Promise<Buffer | undefined> {
    try {
      const stream = await downloadContentFromMessage(
        content as Parameters<typeof downloadContentFromMessage>[0],
        type,
      );
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of stream) {
        total += chunk.length;
        if (total > this.MAX_MEDIA_BUFFER_BYTES) {
          chunks.length = 0; // too big: store metadata only
          break;
        }
        chunks.push(Buffer.from(chunk));
      }
      return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    } catch (error) {
      logError('[AntiDeleteService]', error);
      return undefined;
    }
  }

  getMessage(messageId: string): StoredMessage | undefined {
    return this.messageStore.get(messageId);
  }

  deleteMessage(messageId: string): void {
    const stored = this.messageStore.get(messageId);
    if (stored) {
      this.messageStore.delete(messageId);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, msg] of this.messageStore.entries()) {
      if (now - msg.timestamp > this.MAX_MESSAGE_AGE) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.messageStore.delete(id);
    }
  }

  formatDeletedMessageNotification(
    deletedBy: string,
    original: StoredMessage,
    _sock: WASocket,
  ): string {
    const deletedByName = deletedBy.split('@')[0];
    const senderName = original.senderName || original.sender.split('@')[0];
    const time = new Date(original.timestamp).toLocaleString();

    let message = `🔰 *ANTI-DELETE*\n\n`;
    message += `🗑️ *Eliminado por:* @${deletedByName}\n`;
    message += `👤 *Autor:* @${senderName}\n`;
    message += `🕐 *Hora:* ${time}\n`;

    if (original.groupJid) {
      message += `👥 *Grupo:* ${original.groupJid}\n`;
    }

    if (original.content) {
      message += `\n💬 *Mensaje eliminado:*\n${original.content}`;
    } else if (original.mediaType) {
      message += `\n📎 *Tipo de medio:* ${original.mediaType}`;
    }

    return message;
  }

  private saveConfig(): void {
    this.configStore.save(this.config);
  }
}

export const antiDeleteService = AntiDeleteService.getInstance();
