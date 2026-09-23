import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

interface UserMessageTracker {
  messages: number[];
  warnings: number;
}

export class AntiSpamMiddleware extends Middleware {
  name = 'anti-spam';

  private userMessages = new Map<string, UserMessageTracker>();
  private readonly CLEANUP_INTERVAL = 60000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.cleanupTimer = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

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
      tracker = { messages: [], warnings: 0 };
      this.userMessages.set(key, tracker);
    }

    this.decayWarnings(key);

    tracker.messages = tracker.messages.filter(time => now - time < timeWindow);
    tracker.messages.push(now);

    if (tracker.messages.length > maxMessages) {
      tracker.warnings++;

      if (tracker.warnings === 1) {
        await ctx.reply('⚠️ *Advertencia:* No hagas spam');
        return;
      }

      if (tracker.warnings === 2) {
        await ctx.reply('⚠️ *Última advertencia:* Deja de hacer spam o serás expulsado');
        return;
      }

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

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;

    for (const [key, tracker] of this.userMessages.entries()) {
      if (tracker.messages.length === 0 || tracker.messages.every(time => now - time > maxAge)) {
        this.userMessages.delete(key);
      }
    }
  }

  /** Reset a user's accumulated warnings if they behaved for a while. */
  private decayWarnings(key: string): void {
    const tracker = this.userMessages.get(key);
    if (!tracker) return;
    const WARNING_DECAY_MS = 10 * 60 * 1000;
    const now = Date.now();
    // If no messages were flagged recently, treat old warnings as expired.
    const lastActivity =
      tracker.messages.length > 0 ? tracker.messages[tracker.messages.length - 1] : 0;
    if (tracker.warnings > 0 && now - lastActivity > WARNING_DECAY_MS) {
      tracker.warnings = 0;
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
