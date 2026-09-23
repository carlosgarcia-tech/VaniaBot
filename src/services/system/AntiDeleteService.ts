import type { WASocket } from 'baileys';
import { downloadContentFromMessage } from 'baileys';
import type { proto } from 'baileys';
import fs from 'fs';
import path from 'path';
import { logError } from '@/utils/logger.js';

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

export class AntiDeleteService {
  private static instance: AntiDeleteService;
  private messageStore = new Map<string, StoredMessage>();
  private config: AntiDeleteConfig = { enabled: false, groups: {} };
  private readonly TMP_DIR = path.join(process.cwd(), 'tmp', 'antidelete');
  private readonly MAX_MESSAGE_AGE = 24 * 60 * 60 * 1000;
  /** Hard cap on stored entries to prevent unbounded RAM growth. */
  private readonly MAX_STORED_MESSAGES = 500;
  /** Messages bigger than this are stored as metadata only (no buffer). */
  private readonly MAX_MEDIA_BUFFER_BYTES = 8 * 1024 * 1024;

  constructor() {
    this.ensureTmpDir();
    this.loadConfig();
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

  private loadConfig(): void {
    const configPath = path.join(process.cwd(), 'data', 'antidelete.json');
    try {
      if (fs.existsSync(configPath)) {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch {
      this.config = { enabled: false, groups: {} };
    }
  }

  private saveConfig(): void {
    const configPath = path.join(process.cwd(), 'data', 'antidelete.json');
    const dataDir = path.dirname(configPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
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
      this.saveConfig();
    } else {
      this.config.enabled = true;
      this.saveConfig();
    }
  }

  disable(groupJid?: string): void {
    if (groupJid) {
      this.config.groups[groupJid] = false;
      this.saveConfig();
    } else {
      this.config.enabled = false;
      this.saveConfig();
    }
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
      try {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
          if (chunks.reduce((acc, c) => acc + c.length, 0) > this.MAX_MEDIA_BUFFER_BYTES) {
            chunks.length = 0; // too big: store metadata only
            break;
          }
        }
        if (chunks.length > 0) mediaBuffer = Buffer.concat(chunks);
      } catch (error) {
        logError('[AntiDeleteService]', error);
      }
    } else if (message.message?.videoMessage) {
      mediaType = 'video';
      content = message.message.videoMessage.caption || '';
      // Videos can be huge; skip buffering them entirely to protect RAM.
    } else if (message.message?.stickerMessage) {
      mediaType = 'sticker';
      try {
        const stream = await downloadContentFromMessage(message.message.stickerMessage, 'sticker');
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        mediaBuffer = Buffer.concat(chunks);
      } catch (error) {
        logError('[AntiDeleteService]', error);
      }
    } else if (message.message?.audioMessage) {
      mediaType = 'audio';
      try {
        const stream = await downloadContentFromMessage(message.message.audioMessage, 'audio');
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
          if (chunks.reduce((acc, c) => acc + c.length, 0) > this.MAX_MEDIA_BUFFER_BYTES) {
            chunks.length = 0;
            break;
          }
        }
        if (chunks.length > 0) mediaBuffer = Buffer.concat(chunks);
      } catch (error) {
        logError('[AntiDeleteService]', error);
      }
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
}

export const antiDeleteService = AntiDeleteService.getInstance();
