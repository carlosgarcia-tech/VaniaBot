import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';

export class CooldownMiddleware extends Middleware {
  name = 'cooldown';

  constructor(private registry: CommandRegistry) {
    super();
  }

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
      await ctx.reply(`⏱️ Espera ${remainingTime}s antes de usar este comando nuevamente`);
      return;
    }

    await next();
  }
}
