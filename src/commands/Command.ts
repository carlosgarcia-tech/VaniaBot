import { CommandContext, PermissionLevel } from '@/types/index.js';
import type { ICommand, MessageContext, CommandCategory, BotPermission } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

export abstract class Command implements ICommand {
  abstract name: string;
  abstract description: string;
  abstract category: CommandCategory;

  aliases?: string[] = [];
  usage?: string;
  examples?: string[] = [];
  cooldown?: number = 3000;
  parallelizable?: boolean = false;
  enabled?: boolean = true;
  nsfw?: boolean = false;

  permissions?: {
    user?: PermissionLevel[];
    bot?: BotPermission[];
  } = {
    user: [PermissionLevel.USER],
    bot: [],
  };

  contexts?: CommandContext[] = [CommandContext.BOTH];

  requiresRegistration?: boolean = false;

  abstract execute(ctx: MessageContext): Promise<void>;

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
      await ctx.reply(errorMsg || '❌ Error. Intenta de nuevo.');
      return false;
    }
  }
}
