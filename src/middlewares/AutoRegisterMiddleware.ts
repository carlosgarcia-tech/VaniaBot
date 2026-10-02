import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';

/**
 * Middleware that automatically registers users and groups on first interaction.
 * Creates user/group entries in the database if they don't exist.
 */
export class AutoRegisterMiddleware extends Middleware {
  name = 'auto-register';

  /**
   * Executes the auto-registration logic.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when registration completes.
   */
  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    try {
      const userExists = await serviceManager.db.has('users', ctx.sender.jid);

      if (!userExists) {
        await serviceManager.userService.getUser(ctx.sender.jid);

        await serviceManager.userService.updateUser(ctx.sender.jid, {
          name: ctx.sender.pushName,
        });

        logger.debug(`User auto-registered: ${ctx.sender.pushName}`);
      } else {
        await serviceManager.userService.updateUser(ctx.sender.jid, {
          updatedAt: Date.now(),
          name: ctx.sender.pushName,
        });
      }

      if (ctx.chat.isGroup) {
        const groupExists = await serviceManager.db.has('groups', ctx.chat.jid);

        if (!groupExists) {
          await serviceManager.groupService.getGroup(ctx.chat.jid);
          logger.debug(`Group auto-registered: ${ctx.chat.jid}`);
        }
      }

      await next();
    } catch (error) {
      logError('Error in AutoRegisterMiddleware:', error);
      await next();
    }
  }
}