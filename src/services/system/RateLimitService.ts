/**
 * RateLimitService.ts
 *
 * Global rate limiting service for group messages and flood protection.
 * Tracks message rates per group and user, with configurable whitelist.
 *
 * @author **Carlos G** ⭐
 */

import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitTime?: number;
}

interface GroupTracker {
  messages: number[];
  warnings: number;
  /** Last time a warning was issued; drives warning decay. */
  lastWarningAt: number;
}

interface UserTracker {
  messages: number[];
  lastWarningTime: number;
}

export class RateLimitService {
  /** Quiet time before a group's accumulated warnings are reset. */
  private static readonly WARNING_DECAY_MS = 10 * 60 * 1000;

  private groupTrackers = new Map<string, GroupTracker>();
  private userTrackers = new Map<string, UserTracker>();
  private readonly config = config.rateLimit;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanup();
    logger.debug('[RateLimit] Service initialized');
  }

  checkGroupRateLimit(groupJid: string): RateLimitResult {
    if (this.isGroupWhitelisted(groupJid)) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowMs = this.config.windowMs;
    const maxMessages = this.config.maxMessagesPerGroup;

    let tracker = this.groupTrackers.get(groupJid);
    if (!tracker) {
      tracker = { messages: [], warnings: 0, lastWarningAt: 0 };
      this.groupTrackers.set(groupJid, tracker);
    }

    this.decayWarnings(groupJid);

    tracker.messages = tracker.messages.filter(time => now - time < windowMs);
    tracker.messages.push(now);

    if (tracker.messages.length > maxMessages) {
      tracker.warnings++;
      tracker.lastWarningAt = now;

      if (tracker.warnings === 1) {
        return {
          allowed: false,
          reason: '⚠️ El grupo está enviando muchos mensajes. Reduce la velocidad.',
          waitTime: windowMs,
        };
      }

      if (tracker.warnings >= 3) {
        return {
          allowed: false,
          reason: '⛔ Grupo bloqueado temporalmente por spam',
          waitTime: windowMs * 2,
        };
      }

      return {
        allowed: false,
        reason: '⚠️ Demasiados mensajes del grupo',
        waitTime: Math.ceil(windowMs / 2),
      };
    }

    return { allowed: true };
  }

  checkFlood(userJid: string): RateLimitResult {
    if (this.isUserWhitelisted(userJid)) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowMs = this.config.floodWindowMs;
    const maxPerSecond = this.config.floodMaxPerSecond;

    let tracker = this.userTrackers.get(userJid);
    if (!tracker) {
      tracker = { messages: [], lastWarningTime: 0 };
      this.userTrackers.set(userJid, tracker);
    }

    tracker.messages = tracker.messages.filter(time => now - time < windowMs);

    const perSecondCount = tracker.messages.filter(time => now - time < 1000).length;

    if (perSecondCount >= maxPerSecond) {
      // Reply only once per 5s window: previously every blocked message got a
      // warning reply, amplifying floods instead of damping them.
      const shouldWarn = now - tracker.lastWarningTime > 5000;
      if (shouldWarn) tracker.lastWarningTime = now;
      return {
        allowed: false,
        ...(shouldWarn
          ? {
              reason: '⚠️ Estás escribiendo muy rápido. Espera un momento.',
              waitTime: 2000,
            }
          : {}),
      };
    }

    tracker.messages.push(now);
    return { allowed: true };
  }

  /**
   * Resets a group's accumulated warnings after WARNING_DECAY_MS of quiet
   * time since the last warning. Mirrors the decay in AntiSpamMiddleware:
   * without it a once-active group could stay at "⛔ bloqueado" forever,
   * because the cleanup pass kept the tracker alive while warnings > 0.
   */
  private decayWarnings(groupJid: string): void {
    const tracker = this.groupTrackers.get(groupJid);
    if (!tracker) return;
    if (
      tracker.warnings > 0 &&
      Date.now() - tracker.lastWarningAt > RateLimitService.WARNING_DECAY_MS
    ) {
      tracker.warnings = 0;
    }
  }

  isGroupWhitelisted(groupJid: string): boolean {
    return this.config.whitelistGroups.some(whitelisted => whitelisted === groupJid);
  }

  isUserWhitelisted(userJid: string): boolean {
    return this.config.whitelistUsers.some(whitelisted => whitelisted === userJid);
  }

  addGroupToWhitelist(groupJid: string): void {
    if (!this.isGroupWhitelisted(groupJid)) {
      this.config.whitelistGroups.push(groupJid);
      logger.info(`[RateLimit] Group ${groupJid} added to whitelist`);
    }
  }

  removeGroupFromWhitelist(groupJid: string): void {
    const index = this.config.whitelistGroups.findIndex(g => g === groupJid);
    if (index !== -1) {
      this.config.whitelistGroups.splice(index, 1);
      logger.info(`[RateLimit] Group ${groupJid} removed from whitelist`);
    }
  }

  addUserToWhitelist(userJid: string): void {
    if (!this.isUserWhitelisted(userJid)) {
      this.config.whitelistUsers.push(userJid);
      logger.info(`[RateLimit] User ${userJid} added to whitelist`);
    }
  }

  removeUserFromWhitelist(userJid: string): void {
    const index = this.config.whitelistUsers.findIndex(u => u === userJid);
    if (index !== -1) {
      this.config.whitelistUsers.splice(index, 1);
      logger.info(`[RateLimit] User ${userJid} removed from whitelist`);
    }
  }

  getGroupStats(groupJid: string): { messageCount: number; warnings: number } {
    const tracker = this.groupTrackers.get(groupJid);
    if (!tracker) {
      return { messageCount: 0, warnings: 0 };
    }

    const now = Date.now();
    const recentMessages = tracker.messages.filter(time => now - time < this.config.windowMs);

    return {
      messageCount: recentMessages.length,
      warnings: tracker.warnings,
    };
  }

  getStats(): {
    trackedGroups: number;
    trackedUsers: number;
    whitelistGroups: number;
    whitelistUsers: number;
  } {
    return {
      trackedGroups: this.groupTrackers.size,
      trackedUsers: this.userTrackers.size,
      whitelistGroups: this.config.whitelistGroups.length,
      whitelistUsers: this.config.whitelistUsers.length,
    };
  }

  resetGroup(groupJid: string): void {
    this.groupTrackers.delete(groupJid);
    logger.info(`[RateLimit] Group ${groupJid} stats reset`);
  }

  resetUser(userJid: string): void {
    this.userTrackers.delete(userJid);
    logger.info(`[RateLimit] User ${userJid} stats reset`);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000;

      for (const [groupJid, tracker] of this.groupTrackers.entries()) {
        this.decayWarnings(groupJid);
        tracker.messages = tracker.messages.filter(time => now - time < maxAge);
        if (tracker.messages.length === 0) {
          this.groupTrackers.delete(groupJid);
        }
      }

      for (const [userJid, tracker] of this.userTrackers.entries()) {
        tracker.messages = tracker.messages.filter(time => now - time < maxAge);
        if (tracker.messages.length === 0) {
          this.userTrackers.delete(userJid);
        }
      }
    }, 60 * 1000);
    // Cleanup-only timer: stop() clears it during shutdown anyway.
    this.cleanupTimer.unref();
  }
}

export const rateLimitService = new RateLimitService();
