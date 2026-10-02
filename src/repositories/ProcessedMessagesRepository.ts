/**
 * ProcessedMessagesRepository.ts
 *
 * Repository for tracking processed messages to prevent duplicate processing
 * after bot restarts (prevents command spam from queued messages).
 *
 * @author Carlos G
 * @created 2026-04-07
 */

import { getDatabase } from './Database.js';

export interface ProcessedMessageRecord {
  message_id: string;
  bot_id: string;
  processed_at: string;
}

export class ProcessedMessagesRepository {
  private static instance: ProcessedMessagesRepository;

  private constructor() {}

  static getInstance(): ProcessedMessagesRepository {
    if (!ProcessedMessagesRepository.instance) {
      ProcessedMessagesRepository.instance = new ProcessedMessagesRepository();
    }
    return ProcessedMessagesRepository.instance;
  }

  isProcessed(messageId: string, botId: string): boolean {
    const result = getDatabase().fetchOne<ProcessedMessageRecord>(
      'SELECT 1 FROM processed_messages WHERE message_id = ? AND bot_id = ?',
      { params: [messageId, botId] },
    );
    return result !== null;
  }

  markProcessed(messageId: string, botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      `INSERT OR REPLACE INTO processed_messages (message_id, bot_id, processed_at) VALUES (?, ?, ?)`,
      { params: [messageId, botId, now] },
    );
  }

  getLastProcessedAt(botId: string): string | null {
    const result = getDatabase().fetchOne<{ max_processed_at: string }>(
      'SELECT MAX(processed_at) as max_processed_at FROM processed_messages WHERE bot_id = ?',
      { params: [botId] },
    );
    return result?.max_processed_at ?? null;
  }

  cleanOldProcessedMessages(botId: string, olderThanMs: number): number {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const result = getDatabase().query(
      'DELETE FROM processed_messages WHERE bot_id = ? AND processed_at < ?',
      { params: [botId, cutoff] },
    );
    return result?.changes ?? 0;
  }

  deleteForBot(botId: string): number {
    const result = getDatabase().query('DELETE FROM processed_messages WHERE bot_id = ?', {
      params: [botId],
    });
    return result?.changes ?? 0;
  }

  deleteAll(): number {
    const result = getDatabase().query('DELETE FROM processed_messages');
    return result?.changes ?? 0;
  }
}

export const processedMessagesRepository = ProcessedMessagesRepository.getInstance();
