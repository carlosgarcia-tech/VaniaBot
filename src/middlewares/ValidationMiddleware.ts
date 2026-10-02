/**
 * ValidationMiddleware.ts
 *
 * Rejects commands used in the wrong context (group-only or private-only).
 *
 * This must run before PermissionMiddleware and cannot be registered as
 * parallel: its rejection relies on returning without calling `next()`, which a
 * parallel middleware could not guarantee.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Middleware } from './Middleware.js';
import type { MessageContext, ICommand } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';
import { CommandContext } from '@/types/index.js';

export class ValidationMiddleware extends Middleware {
  name = 'validation';

  constructor(private registry: CommandRegistry) {
    super();
  }

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const command = this.registry.get(ctx.command);

    if (!command) {
      await next();
      return;
    }

    if (!this.validateContext(command, ctx)) {
      await ctx.reply(`❌ Este comando solo funciona en ${this.getRequiredContextName(command)}`);
      return;
    }

    await next();
  }

  /** Human-readable context name used in the rejection message. */
  private getRequiredContextName(command: ICommand): string {
    return command.contexts?.includes(CommandContext.GROUP) ? 'grupos' : 'chats privados';
  }

  /**
   * True when the current chat type is among the command's allowed contexts.
   * A command with no `contexts`, or with BOTH, accepts anything.
   */
  private validateContext(command: ICommand, ctx: MessageContext): boolean {
    if (!command.contexts || command.contexts.includes(CommandContext.BOTH)) return true;

    if (command.contexts.includes(CommandContext.GROUP) && !ctx.chat.isGroup) return false;

    if (command.contexts.includes(CommandContext.PRIVATE) && ctx.chat.isGroup) return false;

    return true;
  }
}
