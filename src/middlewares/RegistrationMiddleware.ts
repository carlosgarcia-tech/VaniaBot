import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import type { ICommand } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logError } from '@/utils/logger.js';

/**
 * Middleware that enforces user registration for commands that require it.
 * Checks if the user has a registered name and prompts for registration if not.
 */
export class RegistrationMiddleware extends Middleware {
  name = 'registration';

  /**
   * Executes the registration check.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when the check completes.
   */
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
          `Registration Required\n\n` +
            `You need to register to use this command.\n\n` +
            `How to register:\n` +
            `Use: *!reg name.age*\n\n` +
            `Example:\n` +
            `!reg Carlos.25\n\n` +
            `Note: The name cannot be changed after registration.`,
        );
        return;
      }

      await next();
    } catch (error) {
      logError('[Registration]', error);
      await ctx.reply(
        `Registration Required\n\n` +
          `You need to register to use this command.\n\n` +
          `Use: *!reg name.age*`,
      );
    }
  }
}