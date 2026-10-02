/**
 * PermissionMiddleware.ts
 *
 * Middleware for checking user and bot permissions before command execution.
 * Includes support for admin-only mode and owner exceptions.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Middleware } from './Middleware.js';
import type { MessageContext, ICommand } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';
import { PermissionLevel, BotPermission } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { PermissionService } from '@/services/PermissionService.js';
import { middlewareCache } from './MiddlewareCache.js';

/**
 * Middleware that validates user and bot permissions before command execution.
 * Handles admin-only mode and owner exceptions.
 */
export class PermissionMiddleware extends Middleware {
  name = 'permission';

  /**
   * Creates a new PermissionMiddleware instance.
   *
   * @param registry - The command registry for looking up commands
   */
  constructor(private registry: CommandRegistry) {
    super();
  }

  /**
   * Executes the middleware to check permissions.
   * First checks admin-only mode, then validates user/bot permissions.
   *
   * @param ctx - The message context
   * @param next - The next middleware in the chain
   * @returns Promise<void>
   */
  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const command = this.registry.get(ctx.command);

    if (!command) {
      await next();
      return;
    }

    if (ctx.chat.isGroup) {
      await ctx.loadBotPermissions();

      if (ctx.sender.jid.endsWith('@lid')) {
        const isOwner = await PermissionService.isOwnerAsync(ctx.sock, ctx.sender.jid);
        if (isOwner) {
          ctx.setOwnerOverride(true);
        }
      }

      const onlyAdmin = await this.getOnlyAdmin(ctx.chat.jid);

      if (onlyAdmin) {
        await ctx.loadSenderPermissions();
        if (!ctx.sender.isOwner && !ctx.sender.isAdmin) {
          await ctx.react('❌');
          return;
        }
      } else {
        await ctx.loadSenderPermissions();
      }
    }

    if (!(await this.checkUserPermissions(command, ctx))) {
      await ctx.reply('❌ No tienes permiso para usar este comando');
      return;
    }

    if (ctx.chat.isGroup && !this.checkBotPermissions(command, ctx)) {
      await ctx.reply('❌ El bot necesita ser admin para ejecutar este comando');
      return;
    }

    await next();
  }

  private async getOnlyAdmin(groupJid: string): Promise<boolean> {
    const cacheKey = groupJid;
    let cached = middlewareCache.onlyAdminMode.get<{ value: boolean }>(cacheKey);

    if (cached === undefined) {
      const onlyAdmin = await serviceManager.groupService.getOnlyAdmin(groupJid);
      cached = { value: onlyAdmin };
      middlewareCache.onlyAdminMode.set(cacheKey, cached);
    }

    return cached.value;
  }

  /**
   * Checks if the user has the required permissions for a command.
   * Owners always have access.
   *
   * @param command - The command to check
   * @param ctx - The message context
   * @returns true if user has permission, false otherwise
   */
  private async checkUserPermissions(command: ICommand, ctx: MessageContext): Promise<boolean> {
    const requiredPerms = command.permissions?.user || [PermissionLevel.USER];

    if (ctx.sender.isOwner) return true;

    if (requiredPerms.includes(PermissionLevel.OWNER)) {
      if (ctx.sender.isOwner) return true;
      const userFromDb = await serviceManager.userService.getUser(ctx.sender.jid);
      return userFromDb.isOwner;
    }

    if (requiredPerms.includes(PermissionLevel.ADMIN)) {
      return ctx.sender.isAdmin || ctx.sender.isOwner;
    }

    return true;
  }

  /**
   * Checks if the bot has the required permissions for a command.
   *
   * @param command - The command to check
   * @param ctx - The message context
   * @returns true if bot has permission, false otherwise
   */
  private checkBotPermissions(command: ICommand, ctx: MessageContext): boolean {
    const requiredPerms = command.permissions?.bot || [];

    if (requiredPerms.length === 0) return true;

    if (requiredPerms.includes(BotPermission.ADMIN)) return ctx.chat.isBotAdmin;

    return true;
  }
}
