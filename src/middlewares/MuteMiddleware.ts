import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { middlewareCache } from './MiddlewareCache.js';

/**
 * Middleware that handles muted users in group chats.
 * Deletes messages from muted users if the bot is an admin.
 */
export class MuteMiddleware extends Middleware {
  name = 'mute';

  /**
   * Executes the mute check.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when the check completes.
   */
  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    await ctx.loadBotPermissions();

    const cacheKey = `${ctx.chat.jid}:${ctx.sender.jid}`;
    const cached = middlewareCache.userMuted.get<{ value: boolean }>(cacheKey);

    if (cached?.value === true) {
      if (ctx.chat.isBotAdmin) {
        try {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            delete: ctx.message.key,
          });
        } catch (error) {
          logError('[MUTE] Error deleting message', error);
        }
      }

      return;
    }

    await next();
  }
}