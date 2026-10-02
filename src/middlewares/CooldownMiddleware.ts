import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';

/**
 * Middleware that enforces command cooldowns per user.
 * Checks the command registry for cooldown settings and blocks execution
 * if the user is on cooldown.
 */
export class CooldownMiddleware extends Middleware {
  name = 'cooldown';

  /**
   * Creates a new CooldownMiddleware.
   *
   * @param registry - The command registry to check cooldowns against.
   */
  constructor(private registry: CommandRegistry) {
    super();
  }

  /**
   * Executes the cooldown check.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when the check completes.
   */
  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const command = this.registry.get(ctx.command);

    if (!command) {
      await next();
      return;
    }

    const cooldownTime = command.cooldown || 3000;
    const canExecute = this.registry.checkCooldown(command.name, ctx.sender.jid, cooldownTime);

    if (!canExecute) {
      // Real remaining time for this user/command, not the total cooldown.
      const remainingMs = this.registry.getCooldownRemaining(command.name, ctx.sender.jid);
      const remainingTime = Math.max(1, Math.ceil(remainingMs / 1000));
      await ctx.reply(`Wait ${remainingTime}s before using this command again`);
      return;
    }

    await next();
  }
}