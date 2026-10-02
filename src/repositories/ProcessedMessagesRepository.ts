/**
 * ProcessedMessagesRepository.ts
 *
 * Repository for tracking processed messages to prevent duplicate processing
 * after bot restarts (prevents command spam from queued messages).
 */

import { getDatabase } from './Database.js';

export interface ProcessedMessageRecord {
  message_id: string;
  bot_id: string;
  processed_at: string;
}

/**
 * Repository for managing processed message deduplication.
 * Implements singleton pattern for global access.
 */
export class ProcessedMessagesRepository {
  private static instance: ProcessedMessagesRepository;

  private constructor() {}

  /**
   * Gets the singleton instance.
   *
   * @returns The ProcessedMessagesRepository instance.
   */
  static getInstance(): ProcessedMessagesRepository {
    if (!ProcessedMessagesRepository.instance) {
      ProcessedMessagesRepository.instance = new ProcessedMessagesRepository();
    }
    return ProcessedMessagesRepository.instance;
  }

  /**
   * Checks if a message has been processed.
   *
   * @param messageId - The message ID.
   * @param botId - The bot ID.
   * @returns True if the message was already processed.
   */
  isProcessed(messageId: string, botId: string): boolean {
    const result = getDatabase().fetchOne<ProcessedMessageRecord>(
      'SELECT 1 FROM processed_messages WHERE message_id = ? AND bot_id = ?',
      { params: [messageId, botId] },
    );
    return result !== null;
  }

  /**
   * Marks a message as processed.
   *
   * @param messageId - The message ID.
   * @param botId - The bot ID.
   */
  markProcessed(messageId: string, botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      `INSERT OR REPLACE INTO processed_messages (message_id, bot_id, processed_at) VALUES (?, ?, ?)`,
      { params: [messageId, botId, now] },
    );
  }

  /**
   * Gets the timestamp of the last processed message for a bot.
   *
   * @param botId - The bot ID.
   * @returns The timestamp or null if no messages processed.
   */
  getLastProcessedAt(botId: string): string | null {
    const result = getDatabase().fetchOne<{ max_processed_at: string }>(
      'SELECT MAX(processed_at) as max_processed_at FROM processed_messages WHERE bot_id = ?',
      { params: [botId] },
    );
    return result?.max_processed_at ?? null;
  }

  /**
   * Cleans old processed messages for a bot.
   *
   * @param botId - The bot ID.
   * @param olderThanMs - Age threshold in milliseconds.
   * @returns The number of deleted records.
   */
  cleanOldProcessedMessages(botId: string, olderThanMs: number): number {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const result = getDatabase().query(
      'DELETE FROM processed_messages WHERE bot_id = ? AND processed_at < ?',
      { params: [botId, cutoff] },
    );
    return result?.changes ?? 0;
  }

  /**
   * Deletes all processed messages for a bot.
   *
   * @param botId - The bot ID.
   * @returns The number of deleted records.
   */
  deleteForBot(botId: string): number {
    const result = getDatabase().query('DELETE FROM processed_messages WHERE bot_id = ?', {
      params: [botId],
    });
    return result?.changes ?? 0;
  }

  /**
   * Deletes all processed messages.
   *
   * @returns The number of deleted records.
   */
  deleteAll(): number {
    const result = getDatabase().query('DELETE FROM processed_messages');
    return result?.changes ?? 0;
  }
}

export const processedMessagesRepository = ProcessedMessagesRepository.getInstance();