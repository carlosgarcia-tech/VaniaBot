/**
 * GrantCommand.ts
 *
 * owner command `grant` — Concede recursos a un usuario (solo owners)
 * Usage: !grant <money|xp|item> <@usuario> <cantidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { checkPinVerification } from '@/utils/pinVerificationHelper.js';

/** Command handler for `!grant`: Concede recursos a un usuario (solo owners). */
export class GrantCommand extends Command {
  name = 'grant';
  description = 'Concede recursos a un usuario (solo owners)';
  category = CommandCategory.OWNER;
  aliases = ['conceder', 'give', 'dar'];
  usage = '!grant <money|xp|item> <@usuario> <cantidad>';
  examples = [
    '!grant money @5215551234567 1000',
    '!grant xp @5215551234567 500',
    '!grant item @5215551234567 diamond',
  ];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    const argsString = ctx.args.join(' ');

    const { requiresPin: _requiresPin, canExecute } = await checkPinVerification(
      ctx,
      'grant',
      argsString,
    );
    if (!canExecute) {
      return;
    }

    if (args.length < 3) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, algo no está bien* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ así lo haces: ${this.usage}\n\n` +
          `✩ *ejemplos:*\n${this.examples.map(ex => `  ﹒${ex}`).join('\n')}`,
      );
      return;
    }

    const type = args[0].toLowerCase();
    const mentionedJid = ctx.mentionedJid;

    if (!mentionedJid) {
      await ctx.reply(' Debes mencionar a un usuario');
      return;
    }

    const targetUser = await serviceManager.userService.getUser(mentionedJid);

    try {
      switch (type) {
        case 'money':
        case 'dinero':
        case 'cash':
          await this.grantMoney(ctx, mentionedJid, args[2], targetUser.name);
          break;

        case 'xp':
        case 'exp':
        case 'experiencia':
          await this.grantXP(ctx, mentionedJid, args[2], targetUser.name);
          break;

        case 'item':
        case 'objeto':
          await this.grantItem(ctx, mentionedJid, args[2], targetUser.name);
          break;

        default:
          await ctx.reply(' Tipo inválido. Usa: money, xp, o item');
      }
    } catch (error) {
      logError('[GrantCommand] Error', error);
      await ctx.reply(` Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
  }

  private async grantMoney(
    ctx: MessageContext,
    targetJid: string,
    amountStr: string,
    targetName: string,
  ): Promise<void> {
    const amount = parseInt(amountStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(' La cantidad debe ser un número positivo');
      return;
    }

    await serviceManager.userService.grantMoney(ctx.sender.jid, targetJid, amount);

    await ctx.reply(` Se han concedido $${formatNumber(amount)} a ${targetName}`);
  }

  private async grantXP(
    ctx: MessageContext,
    targetJid: string,
    amountStr: string,
    targetName: string,
  ): Promise<void> {
    const amount = parseInt(amountStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(' La cantidad debe ser un número positivo');
      return;
    }

    await serviceManager.userService.grantXP(ctx.sender.jid, targetJid, amount);

    const updatedUser = await serviceManager.userService.getUser(targetJid);

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *${targetName} recibió ${formatNumber(amount)} XP* ˚₊· ͟͟͞͞➳\n\n` +
        `✩ ahora está en nivel: *${updatedUser.level}* ✩`,
    );
  }

  private async grantItem(
    ctx: MessageContext,
    targetJid: string,
    item: string,
    targetName: string,
  ): Promise<void> {
    if (!item || item.trim() === '') {
      await ctx.reply(' Debes especificar un item válido');
      return;
    }

    await serviceManager.userService.grantItem(ctx.sender.jid, targetJid, item.toLowerCase());

    await ctx.reply(` Se ha concedido el item "${item}" a ${targetName}`);
  }
}
