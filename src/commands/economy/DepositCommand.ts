/**
 * DepositCommand.ts
 *
 * economy command `deposit` — Depositar dinero al banco
 * Usage: !deposit <cantidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

/** Command handler for `!deposit`: Depositar dinero al banco. */
export class DepositCommand extends Command {
  name = 'deposit';
  description = 'Depositar dinero al banco';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['depositar', 'guardar'];
  usage = '!deposit <cantidad>';
  examples = ['!deposit 5000', '!deposit all'];
  cooldown = 3000;

  async execute(ctx: MessageContext): Promise<void> {
    const amountStr = ctx.args[0]?.toLowerCase();

    if (!amountStr) {
      await ctx.reply(
        `🏦 *DEPOSITAR* 🏦\n\n` +
          `✿ *Cómo usar:*\n` +
          `!deposit <cantidad>\n` +
          `!deposit all - Todo el efectivo\n\n` +
          `📝 *Ejemplo:*\n` +
          `!deposit 5000`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      await ctx.reply(`👑 *Eres dueño*, tienes dinero infinito!`);
      return;
    }

    let amount: number;

    if (amountStr === 'all' || amountStr === 'todo') {
      amount = user.money;
    } else {
      amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply(`❌ Cantidad inválida`);
        return;
      }
    }

    if (user.money < amount) {
      await ctx.reply(
        `❌ *No tienes suficiente dinero*\n\n` +
          `💰 Tienes: $${formatNumber(user.money)}\n` +
          `💸 Intentaste depositar: $${formatNumber(amount)}`,
      );
      return;
    }

    await serviceManager.userService.removeMoney(ctx.sender.jid, amount);
    await serviceManager.userService.addBank(ctx.sender.jid, amount);

    const newMoney = user.money - amount;
    const newBank = (user.bank || 0) + amount;

    await ctx.reply(
      `🏦 *DEPOSITADO!* 🏦\n\n` +
        `💰 Depositaste: $${formatNumber(amount)}\n\n` +
        `📊 *Nuevo balance:*\n` +
        `💵 Efectivo: $${formatNumber(newMoney)}\n` +
        `🏦 Banco: $${formatNumber(newBank)}\n\n` +
        `🛡️ *Tu dinero está seguro!*`,
    );

    await ctx.react('✅');
  }
}
