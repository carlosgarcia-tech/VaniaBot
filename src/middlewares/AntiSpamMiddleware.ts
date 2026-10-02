/**
 * AntiSpamMiddleware.ts
 *
 * Per-group spam enforcement with a three-strike escalation:
 * warn, final warning, then kick (when the bot is an admin).
 *
 * Only applies to group chats whose `antiSpam` setting is enabled, and reads
 * thresholds from the group configuration rather than global config, so each
 * group can be tuned independently.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Quiet period after which accumulated warnings are forgiven. */
const WARNING_DECAY_MS = 10 * 60 * 1000;
/** How long a tracker with no recent activity is retained before cleanup. */
const MAX_TRACKER_AGE_MS = 5 * 60 * 1000;

interface UserMessageTracker {
  /** Timestamps of messages still inside the group's configured window. */
  messages: number[];
  /** Consecutive violations; reset by decayWarnings. */
  warnings: number;
  /** Last time a warning was issued; drives warning decay. */
  lastWarningAt: number;
}

export class AntiSpamMiddleware extends Middleware {
  name = 'anti-spam';

  /** Per group+user trackers keyed `${groupJid}:${userJid}`. */
  private userMessages = new Map<string, UserMessageTracker>();
  private readonly CLEANUP_INTERVAL = 60000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.cleanupTimer = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Counts the message against the user's sliding window and escalates when the
   * group limit is exceeded. Returns (without calling `next`) as soon as the
   * user is over the threshold, so the command never executes.
   */
  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    const groupSettings = await serviceManager.groupService.getGroup(ctx.chat.jid);

    if (!groupSettings.antiSpam.enabled) {
      await next();
      return;
    }

    const key = `${ctx.chat.jid}:${ctx.sender.jid}`;
    const now = Date.now();
    const timeWindow = groupSettings.antiSpam.timeWindow * 1000;
    const maxMessages = groupSettings.antiSpam.maxMessages;

    let tracker = this.userMessages.get(key);
    if (!tracker) {
      tracker = { messages: [], warnings: 0, lastWarningAt: 0 };
      this.userMessages.set(key, tracker);
    }

    this.decayWarnings(key);

    tracker.messages = tracker.messages.filter(time => now - time < timeWindow);
    tracker.messages.push(now);

    if (tracker.messages.length > maxMessages) {
      tracker.warnings++;
      tracker.lastWarningAt = now;

      if (tracker.warnings === 1) {
        await ctx.reply('⚠️ *Advertencia:* No hagas spam');
        return;
      }

      if (tracker.warnings === 2) {
        await ctx.reply('⚠️ *Última advertencia:* Deja de hacer spam o serás expulsado');
        return;
      }

      // Escalation step 3: kick, but only when the bot actually has the rights.
      // Without admin rights the user is still warned so the state is visible.
      if (tracker.warnings >= 3 && ctx.chat.isBotAdmin) {
        try {
          await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [ctx.sender.jid], 'remove');
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `❌ ${ctx.sender.pushName} fue expulsado por spam`,
          });
        } catch (_err) {
          await ctx.reply('❌ No pude expulsar al usuario (falta permisos)');
        } finally {
          this.userMessages.delete(key);
        }
        return;
      }

      if (tracker.warnings >= 3) {
        await ctx.reply('❌ Spam detectado. Serías expulsado si el bot fuera administrador.');
        return;
      }
    }

    await next();
  }

  /** Periodic sweep dropping trackers with no activity inside MAX_TRACKER_AGE_MS. */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = MAX_TRACKER_AGE_MS;

    for (const [key, tracker] of this.userMessages.entries()) {
      if (tracker.messages.length === 0 || tracker.messages.every(time => now - time > maxAge)) {
        this.userMessages.delete(key);
      }
    }
  }

  /**
   * Reset a user's accumulated warnings if they behaved for a while.
   * Uses lastWarningAt as the reference: the messages array is already
   * filtered to the current window, so deriving activity from its newest
   * entry would make the decay almost never fire.
   */
  private decayWarnings(key: string): void {
    const tracker = this.userMessages.get(key);
    if (!tracker) return;
    if (tracker.warnings > 0 && Date.now() - tracker.lastWarningAt > WARNING_DECAY_MS) {
      tracker.warnings = 0;
    }
  }

  /** Clears the cleanup timer. Called by WhatsAppClient.shutdown. */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
