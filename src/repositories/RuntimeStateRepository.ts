/**
 * RuntimeStateRepository.ts
 *
 * Repository for bot runtime state persistence.
 * Tracks heartbeat, connection status, and health metrics per bot.
 */

import { getDatabase } from './Database.js';
import { logger } from '@/utils/logger.js';

export interface BotRuntimeStateRecord {
  bot_id: string;
  is_connected: number;
  last_heartbeat: string | null;
  last_message_processed_at: string | null;
  last_connection_event_at: string | null;
  connection_state: string | null;
  reconnect_attempts: number;
  restart_count: number;
  last_disconnect_reason: string | null;
  last_error: string | null;
  memory_usage_mb: number | null;
  connection_latency_ms: number | null;
  updated_at: string;
  error_count_total?: number;
  messages_total?: number;
  quarantined_until?: string | null;
  quarantine_count?: number;
  last_startup_at?: string | null;
  created_at?: string;
}

export interface CreateRuntimeStateInput {
  bot_id: string;
  is_connected?: number;
  last_heartbeat?: string;
  last_message_processed_at?: string;
  last_connection_event_at?: string;
  connection_state?: string;
  reconnect_attempts?: number;
  restart_count?: number;
  last_disconnect_reason?: string;
  last_error?: string;
  memory_usage_mb?: number;
  connection_latency_ms?: number;
}

export type ConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'quarantined' | 'error';

/**
 * Repository for managing bot runtime state in the database.
 * Implements singleton pattern for global access.
 */
export class RuntimeStateRepository {
  private static instance: RuntimeStateRepository;

  private constructor() {}

  /**
   * Gets the singleton instance.
   *
   * @returns The RuntimeStateRepository instance.
   */
  static getInstance(): RuntimeStateRepository {
    if (!RuntimeStateRepository.instance) {
      RuntimeStateRepository.instance = new RuntimeStateRepository();
    }
    return RuntimeStateRepository.instance;
  }

  /**
   * Creates a new runtime state record for a bot.
   *
   * @param input - The runtime state data to create.
   * @returns The created record.
   */
  create(input: CreateRuntimeStateInput): BotRuntimeStateRecord {
    const now = new Date().toISOString();

    getDatabase().query(
      `INSERT INTO bot_runtime_state (
        bot_id, is_connected, last_heartbeat, last_message_processed_at,
        last_connection_event_at, connection_state, reconnect_attempts,
        restart_count, last_disconnect_reason, last_error, memory_usage_mb,
        connection_latency_ms, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        params: [
          input.bot_id,
          input.is_connected ?? 0,
          input.last_heartbeat ?? null,
          input.last_message_processed_at ?? null,
          input.last_connection_event_at ?? null,
          input.connection_state ?? null,
          input.reconnect_attempts ?? 0,
          input.restart_count ?? 0,
          input.last_disconnect_reason ?? null,
          input.last_error ?? null,
          input.memory_usage_mb ?? null,
          input.connection_latency_ms ?? null,
          now,
        ],
      },
    );

    logger.debug(`[RuntimeStateRepository] Created state for bot: ${input.bot_id}`);
    const record = this.findByBotId(input.bot_id);
    if (!record) throw new Error(`Failed to create runtime state for bot: ${input.bot_id}`);
    return record;
  }

  /**
   * Finds a runtime state record by bot ID.
   *
   * @param botId - The bot ID to search for.
   * @returns The record if found, null otherwise.
   */
  findByBotId(botId: string): BotRuntimeStateRecord | null {
    return getDatabase().fetchOne<BotRuntimeStateRecord>(
      'SELECT * FROM bot_runtime_state WHERE bot_id = ?',
      { params: [botId] },
    );
  }

  /**
   * Finds all runtime state records.
   *
   * @returns An array of all runtime state records.
   */
  findAll(): BotRuntimeStateRecord[] {
    return getDatabase().fetchAll<BotRuntimeStateRecord>('SELECT * FROM bot_runtime_state');
  }

  /**
   * Finds all connected bots.
   *
   * @returns An array of connected bot records.
   */
  findConnected(): BotRuntimeStateRecord[] {
    return getDatabase().fetchAll<BotRuntimeStateRecord>(
      'SELECT * FROM bot_runtime_state WHERE is_connected = 1',
    );
  }

  /**
   * Finds all disconnected bots.
   *
   * @returns An array of disconnected bot records.
   */
  findDisconnected(): BotRuntimeStateRecord[] {
    return getDatabase().fetchAll<BotRuntimeStateRecord>(
      'SELECT * FROM bot_runtime_state WHERE is_connected = 0',
    );
  }

  /**
   * Finds bots with stale heartbeats (potential connection issues).
   *
   * @param maxAgeMs - Maximum age of heartbeat in milliseconds.
   * @returns An array of bot records with stale heartbeats.
   */
  findStaleHeartbeat(maxAgeMs: number): BotRuntimeStateRecord[] {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    return getDatabase().fetchAll<BotRuntimeStateRecord>(
      'SELECT * FROM bot_runtime_state WHERE is_connected = 1 AND (last_heartbeat IS NULL OR last_heartbeat < ?)',
      { params: [cutoff] },
    );
  }

  /**
   * Updates the heartbeat timestamp for a bot.
   *
   * @param botId - The bot ID.
   */
  updateHeartbeat(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET last_heartbeat = ?, updated_at = ? WHERE bot_id = ?',
      { params: [now, now, botId] },
    );
  }

  /**
   * Updates the last message processed timestamp for a bot.
   *
   * @param botId - The bot ID.
   */
  updateMessageProcessed(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET last_message_processed_at = ?, updated_at = ? WHERE bot_id = ?',
      { params: [now, now, botId] },
    );
  }

  /**
   * Updates the last connection event timestamp for a bot.
   *
   * @param botId - The bot ID.
   * @param eventType - The type of connection event.
   */
  updateConnectionEvent(botId: string, _eventType: 'connect' | 'disconnect'): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET last_connection_event_at = ?, updated_at = ? WHERE bot_id = ?',
      { params: [now, now, botId] },
    );
  }

  /**
   * Updates the connection state for a bot.
   *
   * @param botId - The bot ID.
   * @param state - The connection state.
   */
  updateConnectionState(botId: string, state: ConnectionState): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET connection_state = ?, updated_at = ? WHERE bot_id = ?',
      { params: [state, now, botId] },
    );
  }

  /**
   * Updates the connection status and disconnect reason.
   *
   * @param botId - The bot ID.
   * @param isConnected - Whether the bot is connected (1 or 0).
   * @param reason - Optional disconnect reason.
   */
  updateConnection(botId: string, isConnected: number, reason?: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      `UPDATE bot_runtime_state SET 
        is_connected = ?, 
        last_disconnect_reason = ?,
        last_connection_event_at = ?,
        reconnect_attempts = reconnect_attempts + ?,
        updated_at = ? 
      WHERE bot_id = ?`,
      { params: [isConnected, reason ?? null, now, isConnected === 0 ? 1 : 0, now, botId] },
    );
  }

  /**
   * Updates the last error for a bot.
   *
   * @param botId - The bot ID.
   * @param error - The error message.
   */
  updateError(botId: string, error: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET last_error = ?, updated_at = ? WHERE bot_id = ?',
      { params: [error.substring(0, 500), now, botId] },
    );
  }

  /**
   * Increments the restart count for a bot.
   *
   * @param botId - The bot ID.
   */
  incrementRestartCount(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET restart_count = restart_count + 1, last_connection_event_at = ?, updated_at = ? WHERE bot_id = ?',
      { params: [now, now, botId] },
    );
  }

  /**
   * Resets the restart and reconnect counts for a bot.
   *
   * @param botId - The bot ID.
   */
  resetRestarts(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET restart_count = 0, reconnect_attempts = 0, updated_at = ? WHERE bot_id = ?',
      { params: [now, botId] },
    );
  }

  /**
   * Updates metrics for a bot.
   *
   * @param botId - The bot ID.
   * @param metrics - The metrics to update.
   */
  updateMetrics(
    botId: string,
    metrics: {
      memory_usage_mb?: number;
      connection_latency_ms?: number;
    },
  ): void {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (metrics.memory_usage_mb !== undefined) {
      updates.push('memory_usage_mb = ?');
      params.push(metrics.memory_usage_mb);
    }
    if (metrics.connection_latency_ms !== undefined) {
      updates.push('connection_latency_ms = ?');
      params.push(metrics.connection_latency_ms);
    }

    params.push(botId);

    getDatabase().query(`UPDATE bot_runtime_state SET ${updates.join(', ')} WHERE bot_id = ?`, {
      params,
    });
  }

  /**
   * Resets the reconnect attempts for a bot.
   *
   * @param botId - The bot ID.
   */
  resetReconnectAttempts(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET reconnect_attempts = 0, updated_at = ? WHERE bot_id = ?',
      { params: [now, botId] },
    );
  }

  /**
   * Sets a bot as quarantined for a specified duration.
   *
   * @param botId - The bot ID.
   * @param cooldownMs - The quarantine duration in milliseconds.
   * @param reason - The quarantine reason.
   */
  setQuarantined(botId: string, cooldownMs: number, _reason: string): void {
    const now = new Date();
    const until = new Date(now.getTime() + cooldownMs).toISOString();
    getDatabase().query(
      `UPDATE bot_runtime_state SET 
        quarantined_until = ?, 
        quarantine_count = quarantine_count + 1,
        connection_state = 'quarantined',
        updated_at = ?
      WHERE bot_id = ?`,
      { params: [until, now.toISOString(), botId] },
    );
  }

  /**
   * Releases a bot from quarantine.
   *
   * @param botId - The bot ID.
   */
  releaseFromQuarantine(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET quarantined_until = NULL, connection_state = ?, updated_at = ? WHERE bot_id = ?',
      { params: ['disconnected', now, botId] },
    );
  }

  /**
   * Checks if a bot is currently quarantined.
   *
   * @param botId - The bot ID.
   * @returns True if the bot is quarantined.
   */
  isQuarantined(botId: string): boolean {
    const state = this.findByBotId(botId);
    if (!state || !state.quarantined_until) return false;

    const until = new Date(state.quarantined_until).getTime();
    return Date.now() < until;
  }

  /**
   * Gets all quarantined bots.
   *
   * @returns An array of quarantined bot records.
   */
  getQuarantinedBots(): BotRuntimeStateRecord[] {
    return getDatabase().fetchAll<BotRuntimeStateRecord>(
      'SELECT * FROM bot_runtime_state WHERE quarantined_until IS NOT NULL AND quarantined_until > ?',
      { params: [new Date().toISOString()] },
    );
  }

  /**
   * Gets the last startup timestamp for a bot.
   *
   * @param botId - The bot ID.
   * @returns The startup timestamp or null.
   */
  getLastStartupAt(botId: string): string | null {
    const state = this.findByBotId(botId);
    return state?.last_startup_at ?? null;
  }

  /**
   * Sets the startup timestamp for a bot.
   * Creates the record if it doesn't exist.
   *
   * @param botId - The bot ID.
   */
  setStartupTimestamp(botId: string): void {
    const now = new Date().toISOString();
    // Ensure the row exists first: a bare UPDATE would silently no-op for
    // bots that never got a runtime-state row created.
    getDatabase().query(
      'INSERT OR IGNORE INTO bot_runtime_state (bot_id, updated_at) VALUES (?, ?)',
      {
        params: [botId, now],
      },
    );
    getDatabase().query(
      'UPDATE bot_runtime_state SET last_startup_at = ?, updated_at = ? WHERE bot_id = ?',
      { params: [now, now, botId] },
    );
  }

  /**
   * Increments the error count for a bot.
   *
   * @param botId - The bot ID.
   */
  incrementErrorCount(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET error_count_total = error_count_total + 1, last_error = ?, updated_at = ? WHERE bot_id = ?',
      { params: ['error', now, botId] },
    );
  }

  /**
   * Increments the message count for a bot.
   *
   * @param botId - The bot ID.
   */
  incrementMessageCount(botId: string): void {
    const now = new Date().toISOString();
    getDatabase().query(
      'UPDATE bot_runtime_state SET messages_total = messages_total + 1, last_message_processed_at = ?, updated_at = ? WHERE bot_id = ?',
      { params: [now, now, botId] },
    );
  }

  /**
   * Deletes a bot's runtime state.
   *
   * @param botId - The bot ID.
   * @returns True if the record was deleted.
   */
  delete(botId: string): boolean {
    const before = this.findByBotId(botId);
    if (!before) return false;

    getDatabase().query('DELETE FROM bot_runtime_state WHERE bot_id = ?', {
      params: [botId],
    });
    return true;
  }

  /**
   * Creates or updates a runtime state record.
   *
   * @param input - The runtime state data.
   * @returns The created or updated record.
   */
  upsert(input: CreateRuntimeStateInput): BotRuntimeStateRecord {
    const existing = this.findByBotId(input.bot_id);
    if (existing) {
      this.updateConnection(input.bot_id, input.is_connected ?? 0);
      const record = this.findByBotId(input.bot_id);
      if (!record) throw new Error(`Failed to upsert runtime state for bot: ${input.bot_id}`);
      return record;
    }
    return this.create(input);
  }
}

export const runtimeStateRepository = RuntimeStateRepository.getInstance();