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

export class AntiSpamService {
  private userMessages = new Map<string, number[]>();
  private bannedUsers = new Set<string>();
  private readonly maxMessagesPerSecond: number;
  private readonly maxMessagesPerMinute: number;
  private readonly banDurationMs: number;
  private readonly cleanupIntervalMs: number;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(options: AntiSpamOptions = {}) {
    this.maxMessagesPerSecond =
      options.maxMessagesPerSecond ?? DEFAULT_OPTIONS.maxMessagesPerSecond;
    this.maxMessagesPerMinute =
      options.maxMessagesPerMinute ?? DEFAULT_OPTIONS.maxMessagesPerMinute;
    this.banDurationMs = options.banDurationMs ?? DEFAULT_OPTIONS.banDurationMs;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? DEFAULT_OPTIONS.cleanupIntervalMs;
  }

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

  private banUser(userJid: string): void {
    this.bannedUsers.add(userJid);
    setTimeout(() => this.bannedUsers.delete(userJid), this.banDurationMs);
  }

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

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  clearUser(userJid: string): void {
    this.userMessages.delete(userJid);
    this.bannedUsers.delete(userJid);
  }

  getStats(): { tracked: number; banned: number } {
    return {
      tracked: this.userMessages.size,
      banned: this.bannedUsers.size,
    };
  }
}
