/**
 * CooldownMiddleware.ts
 *
 * Enforces the per-user, per-command cooldown declared by each command.
 *
 * Runs late in the chain (priority 7) so a command is only charged against the
 * user's quota once it is known to be valid and permitted; blocking an
 * unpermitted or mistyped command must not start a cooldown.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';

/** Fallback cooldown applied when a command does not declare one. */
const DEFAULT_COOLDOWN_MS = 3000;

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

    const cooldownTime = command.cooldown || DEFAULT_COOLDOWN_MS;
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
