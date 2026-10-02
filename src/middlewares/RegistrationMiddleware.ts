import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import type { ICommand } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logError } from '@/utils/logger.js';

export class RegistrationMiddleware extends Middleware {
  name = 'registration';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const command = (ctx as MessageContext & { commandObj?: ICommand }).commandObj;

    if (!command?.requiresRegistration) {
      await next();
      return;
    }

    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);

      if (!user.name || user.name === 'User') {
        await ctx.reply(
          `📝 *REGISTRO REQUERIDO*\n\n` +
            `Necesitas registrarte para usar este comando.\n\n` +
            `📌 *Cómo registrarte:*\n` +
            `Usa: *!reg nombre.edad*\n\n` +
            `📌 *Ejemplo:*\n` +
            `!reg Carlos.25\n\n` +
            `⚠️ El nombre no se puede cambiar después.`,
        );
        return;
      }

      await next();
    } catch (error) {
      logError('[Registration]', error);
      await ctx.reply(
        `📝 *REGISTRO REQUERIDO*\n\n` +
          `Necesitas registrarte para usar este comando.\n\n` +
          `Usa: *!reg nombre.edad*`,
      );
    }
  }
}
