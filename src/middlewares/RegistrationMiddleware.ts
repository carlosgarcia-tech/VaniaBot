/**
 * RegistrationMiddleware.ts
 *
 * Enforces registration for commands marked `requiresRegistration`.
 *
 * First in the chain (priority 1) so an unregistered user is stopped before any
 * work is done. A user counts as registered once they have a real name; the
 * sentinel 'User' is what an unregistered row stores.
 *
 * On a lookup failure the user is still asked to register (fail closed), since
 * silently allowing the command would bypass the requirement.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import type { ICommand } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logError } from '@/utils/logger.js';

/** Placeholder name stored for users who have not registered yet. */
const UNREGISTERED_NAME = 'User';

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

      if (!user.name || user.name === UNREGISTERED_NAME) {
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
