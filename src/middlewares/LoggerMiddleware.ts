import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class LoggerMiddleware extends Middleware {
  name = 'logger';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const startTime = Date.now();

    logger.info({
      command: ctx.command,
      user: ctx.sender.pushName,
      jid: ctx.sender.jid,
      chat: ctx.chat.isGroup ? 'group' : 'private',
      chatJid: ctx.chat.jid,
    });

    try {
      await next();

      if (serviceManager.isReady()) {
        await serviceManager.userService.incrementCommands(ctx.sender.jid);

        if (ctx.chat.isGroup) {
          await serviceManager.groupService.incrementCommandCount(ctx.chat.jid);
        }
      }

      const duration = Date.now() - startTime;
      logger.debug(`Comando ${ctx.command} ejecutado en ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        message: `Error ejecutando ${ctx.command}`,
        error,
        duration,
      });
      throw error;
    }
  }
}
