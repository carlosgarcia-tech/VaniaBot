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

  /** Nombre del contexto donde el comando sí está disponible. */
  private getRequiredContextName(command: ICommand): string {
    return command.contexts?.includes(CommandContext.GROUP) ? 'grupos' : 'chats privados';
  }

  private validateContext(command: ICommand, ctx: MessageContext): boolean {
    if (!command.contexts || command.contexts.includes(CommandContext.BOTH)) return true;

    if (command.contexts.includes(CommandContext.GROUP) && !ctx.chat.isGroup) return false;

    if (command.contexts.includes(CommandContext.PRIVATE) && ctx.chat.isGroup) return false;

    return true;
  }
}
