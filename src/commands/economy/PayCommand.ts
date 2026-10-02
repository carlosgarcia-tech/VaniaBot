/**
 * PayCommand.ts
 *
 * economy command `pay` — Transfer money to another user
 * Usage: !pay @user <quantity>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { validateTransferAmount } from '@/utils/validators.js';
import { config } from '@/config/index.js';

/** Command handler for `!pay`: Transfer money to another user. */
export class PayCommand extends Command {
  name = 'pay';
  description = 'Transfer money to another user';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['pay', 'transfer'];
  usage = '!pay @user <quantity>';
  examples = ['!pay @5215551234567 500'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;

    if (!mentionedJid) {
      await ctx.reply('You must mention a user.\n\nUsage: !pay @user <quantity>');
      return;
    }

    const amountStr = ctx.args[1];
    const amount = parseInt(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
      await ctx.reply('Invalid amount\n\nUsage: !pay @user <quantity>');
      return;
    }

    const sender = await serviceManager.userService.getUser(ctx.sender.jid);

    const validation = validateTransferAmount(amount, sender.money, mentionedJid, ctx.sender.jid, {
      minTransfer: config.economy.minTransfer,
      maxTransfer: sender.isOwner ? Infinity : config.economy.maxTransfer,
      isOwner: sender.isOwner,
    });

    if (!validation.valid) {
      await ctx.reply(validation.error || '❌ Transferencia inválida');
      return;
    }

    const success = await serviceManager.userService.transferMoney(
      ctx.sender.jid,
      mentionedJid,
      amount,
    );

    if (!success) {
      await ctx.reply('❌ No tienes suficiente dinero');
      return;
    }

    const receiver = await serviceManager.userService.getUser(mentionedJid);

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *regalito enviado* ˚₊· ͟͟͞͞➳\n\n` +
        `✿ *$${formatNumber(amount)}* se fueron volando\n` +
        `✿ para: ${receiver.name}\n\n` +
        `♡ te quedan: *$${formatNumber(sender.money - amount)}* ♡`,
    );
  }
}
