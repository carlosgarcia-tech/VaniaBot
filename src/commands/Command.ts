import { CommandContext, PermissionLevel } from '@/types/index.js';
import type { ICommand, MessageContext, CommandCategory, BotPermission } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

/**
 * Abstract base class for all bot commands.
 * Provides common functionality for permission checking, context validation,
 * and error handling.
 */
export abstract class Command implements ICommand {
  /** The unique command name */
  abstract name: string;
  /** Command description */
  abstract description: string;
  /** Command category */
  abstract category: CommandCategory;

  /** Alternative command aliases */
  aliases?: string[] = [];
  /** Usage string */
  usage?: string;
  /** Usage examples */
  examples?: string[] = [];
  /** Cooldown in milliseconds (default: 3000) */
  cooldown?: number = 3000;
  /** Whether the command can run in parallel (default: false) */
  parallelizable?: boolean = false;
  /** Whether the command is enabled (default: true) */
  enabled?: boolean = true;
  /** Whether the command is NSFW (default: false) */
  nsfw?: boolean = false;

  /** Permission requirements */
  permissions?: {
    user?: PermissionLevel[];
    bot?: BotPermission[];
  } = {
    user: [PermissionLevel.USER],
    bot: [],
  };

  /** Allowed contexts */
  contexts?: CommandContext[] = [CommandContext.BOTH];

  /** Whether the command requires user registration */
  requiresRegistration?: boolean = false;

  /** Command execution function */
  abstract execute(ctx: MessageContext): Promise<void>;

  /**
   * Checks if the user has the required permissions.
   *
   * @param ctx - The message context.
   * @returns True if the user has permission.
   */
  protected hasPermission(ctx: MessageContext): boolean {
    const requiredPerms = this.permissions?.user || [PermissionLevel.USER];

    if (requiredPerms.includes(PermissionLevel.OWNER)) {
      return ctx.sender.isOwner;
    }

    if (requiredPerms.includes(PermissionLevel.ADMIN)) {
      return ctx.sender.isAdmin || ctx.sender.isOwner;
    }

    return true;
  }

  /**
   * Validates if the command can run in the current context.
   *
   * @param ctx - The message context.
   * @returns True if the context is valid.
   */
  protected validateContext(ctx: MessageContext): boolean {
    if (!this.contexts || this.contexts.includes(CommandContext.BOTH)) {
      return true;
    }

    if (this.contexts.includes(CommandContext.GROUP) && !ctx.chat.isGroup) {
      return false;
    }

    if (this.contexts.includes(CommandContext.PRIVATE) && ctx.chat.isGroup) {
      return false;
    }

    return true;
  }

  /**
   * Executes a function with error handling and reaction feedback.
   *
   * @param ctx - The message context.
   * @param fn - The async function to execute.
   * @param errorMsg - Optional custom error message.
   * @returns True if execution succeeded, false otherwise.
   */
  protected async guardedExecute(
    ctx: MessageContext,
    fn: () => Promise<void>,
    errorMsg?: string,
  ): Promise<boolean> {
    try {
      await fn();
      await ctx.react('✅');
      return true;
    } catch (error) {
      logError(`[${this.name}] Error:`, error);
      await ctx.react('❌');
      await ctx.reply(errorMsg || 'Error. Please try again.');
      return false;
    }
  }
}