import { logError } from '@/utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitTime?: number;
}

export interface AntiSpamOptions {
  maxMessagesPerSecond?: number;
  maxMessagesPerMinute?: number;
  banDurationMs?: number;
  cleanupIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<AntiSpamOptions> = {
  maxMessagesPerSecond: 3,
  maxMessagesPerMinute: 20,
  banDurationMs: 5 * 60 * 1000,
  cleanupIntervalMs: 5 * 60 * 1000,
};

/**
 * Service for anti-spam rate limiting.
 * Tracks message frequency per user and enforces limits.
 */
export class AntiSpamService {
  private userMessages = new Map<string, number[]>();
  private bannedUsers = new Set<string>();
  private readonly maxMessagesPerSecond: number;
  private readonly maxMessagesPerMinute: number;
  private readonly banDurationMs: number;
  private readonly cleanupIntervalMs: number;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  /**
   * Creates a new AntiSpamService.
   *
   * @param options - Configuration options for rate limiting.
   */
  constructor(options: AntiSpamOptions = {}) {
    this.maxMessagesPerSecond =
      options.maxMessagesPerSecond ?? DEFAULT_OPTIONS.maxMessagesPerSecond;
    this.maxMessagesPerMinute =
      options.maxMessagesPerMinute ?? DEFAULT_OPTIONS.maxMessagesPerMinute;
    this.banDurationMs = options.banDurationMs ?? DEFAULT_OPTIONS.banDurationMs;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? DEFAULT_OPTIONS.cleanupIntervalMs;
  }

  /**
   * Checks if a user is within rate limits.
   *
   * @param userJid - The user JID to check.
   * @returns The rate limit result.
   */
  check(userJid: string): RateLimitResult {
    if (this.bannedUsers.has(userJid)) {
      return {
        allowed: false,
        reason: 'Temporarily blocked for spam',
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
        reason: 'Too many messages. Temporarily blocked.',
        waitTime: this.banDurationMs,
      };
    }

    const lastSecondMessages = recentMessages.filter(time => now - time < 1000);
    if (lastSecondMessages.length >= this.maxMessagesPerSecond) {
      return { allowed: false, reason: 'You are sending messages too fast', waitTime: 2000 };
    }

    recentMessages.push(now);
    this.userMessages.set(userJid, recentMessages);
    return { allowed: true };
  }

  /**
   * Bans a user temporarily.
   *
   * @param userJid - The user JID to ban.
   */
  private banUser(userJid: string): void {
    this.bannedUsers.add(userJid);
    setTimeout(() => this.bannedUsers.delete(userJid), this.banDurationMs);
  }

  /**
   * Starts the periodic cleanup of old message records.
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

  /**
   * Stops the cleanup interval.
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Clears all tracking data for a user.
   *
   * @param userJid - The user JID to clear.
   */
  clearUser(userJid: string): void {
    this.userMessages.delete(userJid);
    this.bannedUsers.delete(userJid);
  }

  /**
   * Gets service statistics.
   *
   * @returns An object with tracked and banned user counts.
   */
  getStats(): { tracked: number; banned: number } {
    return {
      tracked: this.userMessages.size,
      banned: this.bannedUsers.size,
    };
  }
}