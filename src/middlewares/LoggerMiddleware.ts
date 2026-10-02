import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/**
 * Middleware that logs command execution and tracks command statistics.
 * Logs command details before execution and duration after completion.
 * Increments user and group command counters.
 */
export class LoggerMiddleware extends Middleware {
  name = 'logger';

  /**
   * Executes the logging middleware.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when logging completes.
   */
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
      logger.debug(`Command ${ctx.command} executed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        message: `Error executing ${ctx.command}`,
        error,
        duration,
      });
      throw error;
    }
  }
}