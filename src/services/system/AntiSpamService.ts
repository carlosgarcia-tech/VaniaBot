/**
 * AntiSpamService.ts
 *
 * Process-wide per-user rate limiting, independent of per-group settings.
 *
 * Applied by MainMessagePipeline.checkRateLimits for every message before the
 * middleware chain. Two thresholds are enforced in order — the per-minute limit
 * (which can trigger a temporary ban) and the stricter per-second limit (which
 * only warns).
 *
 * Distinct from middlewares/AntiSpamMiddleware: this one is a global guard
 * configured at construction, while the middleware enforces the per-group
 * `antiSpam` settings.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { logError } from '@/utils/logger.js';

/** Verdict plus the user-facing reason and a suggested wait. */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitTime?: number;
}

/** Tunable limits; each falls back to DEFAULT_OPTIONS. */
export interface AntiSpamOptions {
  maxMessagesPerSecond?: number;
  maxMessagesPerMinute?: number;
  banDurationMs?: number;
  cleanupIntervalMs?: number;
}

/** 3/s, 20/min, with a five-minute ban and five-minute sweep. */
const DEFAULT_OPTIONS: Required<AntiSpamOptions> = {
  maxMessagesPerSecond: 3,
  maxMessagesPerMinute: 20,
  banDurationMs: 5 * 60 * 1000,
  cleanupIntervalMs: 5 * 60 * 1000,
};

export class AntiSpamService {
  /** Message timestamps in the last minute, per user. */
  private userMessages = new Map<string, number[]>();
  /** Users currently in a temporary ban. */
  private bannedUsers = new Set<string>();
  private readonly maxMessagesPerSecond: number;
  private readonly maxMessagesPerMinute: number;
  private readonly banDurationMs: number;
  private readonly cleanupIntervalMs: number;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  /** Resolves limits against the defaults; each option is independent. */
  constructor(options: AntiSpamOptions = {}) {
    this.maxMessagesPerSecond =
      options.maxMessagesPerSecond ?? DEFAULT_OPTIONS.maxMessagesPerSecond;
    this.maxMessagesPerMinute =
      options.maxMessagesPerMinute ?? DEFAULT_OPTIONS.maxMessagesPerMinute;
    this.banDurationMs = options.banDurationMs ?? DEFAULT_OPTIONS.banDurationMs;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? DEFAULT_OPTIONS.cleanupIntervalMs;
  }

  /**
   * Records a message attempt and reports whether it is allowed.
   *
   * Check order matters: an active ban short-circuits, then the per-minute limit
   * (which bans), then the per-second limit (which only warns). The timestamp is
   * appended only when the message is accepted, so blocked traffic does not keep
   * extending the window it is measured against.
   */
  check(userJid: string): RateLimitResult {
    if (this.bannedUsers.has(userJid)) {
      return {
        allowed: false,
        reason: '⛔ Bloqueado temporalmente por spam',
        waitTime: this.banDurationMs,
      };
    }

    const now = Date.now();
    const userMsgs = this.userMessages.get(userJid) ?? [];
    const recentMessages = userMsgs.filter(time => now - time < 60000);

    if (recentMessages.length >= this.maxMessagesPerMinute) {
      this.banUser(userJid);
      return {
        allowed: false,
        reason: '⚠️ Demasiados mensajes. Bloqueado temporalmente.',
        waitTime: this.banDurationMs,
      };
    }

    const lastSecondMessages = recentMessages.filter(time => now - time < 1000);
    if (lastSecondMessages.length >= this.maxMessagesPerSecond) {
      return { allowed: false, reason: '⚠️ Estás escribiendo muy rápido', waitTime: 2000 };
    }

    recentMessages.push(now);
    this.userMessages.set(userJid, recentMessages);
    return { allowed: true };
  }

  /** Bans a user, scheduling their unban with a timer. */
  private banUser(userJid: string): void {
    this.bannedUsers.add(userJid);
    setTimeout(() => this.bannedUsers.delete(userJid), this.banDurationMs);
  }

  /**
   * Starts the periodic sweep that drops fully-expired message windows.
   * Idempotent; safe to call repeatedly.
   */
  startCleanup(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      try {
        const now = Date.now();
        for (const [userJid, messages] of this.userMessages.entries()) {
          const recent = messages.filter(time => now - time < 60000);
          if (recent.length === 0) {
            this.userMessages.delete(userJid);
          } else {
            this.userMessages.set(userJid, recent);
          }
        }
      } catch (error) {
        logError('[AntiSpamService] Cleanup failed', error);
      }
    }, this.cleanupIntervalMs);
  }

  /** Stops the sweep timer. */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /** Resets a user completely: forgets their history and lifts any ban. */
  clearUser(userJid: string): void {
    this.userMessages.delete(userJid);
    this.bannedUsers.delete(userJid);
  }

  /** Number of tracked users and currently banned ones. */
  getStats(): { tracked: number; banned: number } {
    return {
      tracked: this.userMessages.size,
      banned: this.bannedUsers.size,
    };
  }
}
