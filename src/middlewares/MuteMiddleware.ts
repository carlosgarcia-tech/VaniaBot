import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { middlewareCache } from './MiddlewareCache.js';

export class MuteMiddleware extends Middleware {
  name = 'mute';

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
          logError('[MUTE] Error al eliminar mensaje', error);
        }
      }

      return;
    }

    await next();
  }
}
