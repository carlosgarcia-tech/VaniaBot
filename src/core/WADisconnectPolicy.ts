/**
 * WADisconnectPolicy.ts
 *
 * Single source of truth for interpreting Baileys disconnect events, shared
 * by the main bot (AuthManager) and subbots (SubBotInstance):
 *
 * - classifyDisconnect(): maps raw status codes to semantic categories
 * - extractDisconnectInfo(): pulls statusCode/message from lastDisconnect
 * - computeReconnectDelayMs()/nextBackoff(): exponential backoff math
 * - clearSessionFiles(): session directory cleanup shared by 3 call sites
 *
 * Each consumer keeps its own lifecycle (recreate socket in place vs full
 * start(), strike counters, user notifications); only the MEANING of codes
 * and the math/cleanup primitives are unified here.
 */

import { DisconnectReason } from 'baileys';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logError } from '@/utils/logger.js';

/** Semantic categories for disconnect status codes. */
export type DisconnectCategory =
  | 'conflict' // 440 / connectionReplaced: session opened elsewhere
  | 'loggedOut' // 401: session revoked from the phone
  | 'badSession' // corrupt session keys
  | 'timedOut' // 408: connection/pairing timeout
  | 'restartRequired' // 515: WhatsApp asks to restart the connection
  | 'network' // transient network errors (lost/closed, 502, 503...)
  | 'unknown';

export interface DisconnectInfo {
  statusCode?: number;
  message?: string;
}

/**
 * Extracts statusCode/message from a Baileys `lastDisconnect` payload.
 *
 * @param lastDisconnect - The last disconnect payload from Baileys.
 * @returns An object with statusCode and message.
 */
export function extractDisconnectInfo(lastDisconnect: unknown): DisconnectInfo {
  const error = lastDisconnect as
    { error?: { output?: { statusCode?: number }; message?: string } } | undefined;
  const err = error?.error;
  return {
    statusCode: err?.output?.statusCode,
    message: err?.message,
  };
}

/**
 * Maps a raw disconnect status code to its semantic category.
 * Uses DisconnectReason members (not literals) so it stays consistent with
 * the installed Baileys version.
 *
 * @param statusCode - The disconnect status code.
 * @returns The semantic disconnect category.
 */
export function classifyDisconnect(statusCode?: number): DisconnectCategory {
  if (statusCode === undefined) return 'unknown';

  if (statusCode === DisconnectReason.connectionReplaced || statusCode === 440) {
    return 'conflict';
  }
  if (statusCode === DisconnectReason.loggedOut) return 'loggedOut';
  if (statusCode === DisconnectReason.badSession) return 'badSession';
  if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
    return 'restartRequired';
  }
  if (statusCode === DisconnectReason.timedOut || statusCode === 408) {
    return 'timedOut';
  }
  if (
    statusCode === DisconnectReason.connectionLost ||
    statusCode === DisconnectReason.connectionClosed ||
    statusCode === 502 ||
    statusCode === 503
  ) {
    return 'network';
  }
  return 'unknown';
}

/**
 * Computes exponential backoff delay for reconnection attempts.
 *
 * @param attempt - The attempt number (1-based).
 * @param baseDelayMs - The base delay in milliseconds.
 * @param maxDelayMs - The maximum delay cap in milliseconds.
 * @param factor - The exponential factor (default: 1.5).
 * @returns The computed delay in milliseconds.
 */
export function computeReconnectDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  factor = 1.5,
): number {
  return Math.min(baseDelayMs * Math.pow(factor, Math.max(0, attempt - 1)), maxDelayMs);
}

/**
 * Computes the next backoff step given the current delay (used by sequential backoff).
 *
 * @param currentDelayMs - The current delay in milliseconds.
 * @param maxDelayMs - The maximum delay cap in milliseconds.
 * @param factor - The exponential factor (default: 1.5).
 * @returns The next delay in milliseconds.
 */
export function nextBackoff(currentDelayMs: number, maxDelayMs: number, factor = 1.5): number {
  return Math.min(currentDelayMs * factor, maxDelayMs);
}

/**
 * Low-level transport snapshot of a Baileys socket (avoids `any` casts everywhere).
 *
 * @param sock - The socket instance.
 * @returns An object with readyState and hasUser properties.
 */
export function socketTransportState(sock: unknown): {
  readyState?: number;
  hasUser: boolean;
} {
  try {
    const s = sock as { ws?: { readyState?: number }; user?: { id?: string } } | null;
    return {
      readyState: s?.ws?.readyState,
      hasUser: Boolean(s?.user?.id),
    };
  } catch {
    return { hasUser: false };
  }
}

/**
 * Deletes every file inside a session directory. Returns the number of files
 * removed (0 when the directory does not exist). Errors are logged, not
 * thrown, so callers can keep their reconnect flow running.
 *
 * @param sessionPath - The path to the session directory.
 * @param logTag - Optional tag for logging (default: '[WADisconnect]').
 * @returns The number of files removed.
 */
export function clearSessionFiles(sessionPath: string, logTag = '[WADisconnect]'): number {
  try {
    if (!existsSync(sessionPath)) return 0;

    const files = readdirSync(sessionPath);
    let removed = 0;
    for (const file of files) {
      try {
        unlinkSync(join(sessionPath, file));
        removed++;
      } catch (error) {
        logError(logTag, error);
      }
    }
    return removed;
  } catch (error) {
    logError(logTag, error);
    return 0;
  }
}