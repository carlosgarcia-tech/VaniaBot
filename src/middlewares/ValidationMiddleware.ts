import { Middleware } from './Middleware.js';
import type { MessageContext, ICommand } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';
import { CommandContext } from '@/types/index.js';

/**
 * Middleware that validates command context (group vs private chat).
 * Rejects commands that are not available in the current context.
 */
export class ValidationMiddleware extends Middleware {
  name = 'validation';

  /**
   * Creates a new ValidationMiddleware.
   *
   * @param registry - The command registry for looking up commands.
   */
  constructor(private registry: CommandRegistry) {
    super();
  }

  /**
   * Executes the context validation.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when validation completes.
   */
  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const command = this.registry.get(ctx.command);

    if (!command) {
      await next();
      return;
    }

    if (!this.validateContext(command, ctx)) {
      await ctx.reply(`This command only works in ${this.getRequiredContextName(command)}`);
      return;
    }

    await next();
  }

  /**
   * Gets the required context name for a command.
   *
   * @param command - The command to check.
   * @returns The context name ('groups' or 'private chats').
   */
  private getRequiredContextName(command: ICommand): string {
    return command.contexts?.includes(CommandContext.GROUP) ? 'groups' : 'private chats';
  }

  /**
   * Validates if a command can run in the current context.
   *
   * @param command - The command to validate.
   * @param ctx - The message context.
   * @returns True if the command is valid in this context.
   */
  private validateContext(command: ICommand, ctx: MessageContext): boolean {
    if (!command.contexts || command.contexts.includes(CommandContext.BOTH)) return true;

    if (command.contexts.includes(CommandContext.GROUP) && !ctx.chat.isGroup) return false;

    if (command.contexts.includes(CommandContext.PRIVATE) && ctx.chat.isGroup) return false;

    return true;
  }
}