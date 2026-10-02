/**
 * ProcessedMessagesRepository.ts
 *
 * Repository for tracking processed messages to prevent duplicate processing
 * after bot restarts (prevents command spam from queued messages).
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { getDatabase } from './Database.js';

export interface ProcessedMessageRecord {
  message_id: string;
  bot_id: string;
  processed_at: string;
}

/**
 * Durable dedup ledger for handled messages.
 *
 * The in-memory cache in CacheManager only survives while the process lives, so
 * a reconnect that re-delivers a batch of queued messages would re-run their
 * commands. This repository persists what was already handled, letting the
 * pipeline skip those echoes after a restart. Rows are keyed per bot because
 * several sessions can observe the same message ID.
 */
export class ProcessedMessagesRepository {
  private static instance: ProcessedMessagesRepository;

  private constructor() {}

  static getInstance(): ProcessedMessagesRepository {
    if (!ProcessedMessagesRepository.instance) {
      ProcessedMessagesRepository.instance = new ProcessedMessagesRepository();
    }
    return ProcessedMessagesRepository.instance;
  }

  /** True when this bot already handled the message. */
  isProcessed(messageId: string, botId: string): boolean {
    const result = getDatabase().fetchOne<ProcessedMessageRecord>(
      'SELECT 1 FROM processed_messages WHERE message_id = ? AND bot_id = ?',
      { params: [messageId, botId] },
    );
    return result !== null;
  }

  /** Records a message as handled. INSERT OR REPLACE keeps it idempotent. */
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

  /**
   * Prunes entries older than the given age.
   * @returns Number of deleted rows.
   */
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
