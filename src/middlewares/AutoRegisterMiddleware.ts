import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';

export class AutoRegisterMiddleware extends Middleware {
  name = 'auto-register';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    try {
      const userExists = await serviceManager.db.has('users', ctx.sender.jid);

      if (!userExists) {
        await serviceManager.userService.getUser(ctx.sender.jid);

        await serviceManager.userService.updateUser(ctx.sender.jid, {
          name: ctx.sender.pushName,
        });

        logger.debug(`Usuario auto-registrado: ${ctx.sender.pushName}`);
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
          logger.debug(`Grupo auto-registrado: ${ctx.chat.jid}`);
        }
      }

      await next();
    } catch (error) {
      logError('Error en AutoRegisterMiddleware:', error);
      await next();
    }
  }
}
