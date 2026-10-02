/**
 * WithdrawCommand.ts
 *
 * economy command `withdraw` — Retirar dinero del banco
 * Usage: !withdraw <cantidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

/** Command handler for `!withdraw`: Retirar dinero del banco. */
export class WithdrawCommand extends Command {
  name = 'withdraw';
  description = 'Retirar dinero del banco';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['retirar', 'sacar'];
  usage = '!withdraw <cantidad>';
  examples = ['!withdraw 5000', '!withdraw all'];
  cooldown = 3000;

  async execute(ctx: MessageContext): Promise<void> {
    const amountStr = ctx.args[0]?.toLowerCase();

    if (!amountStr) {
      await ctx.reply(
        `🏦 *RETIRAR* 🏦\n\n` +
          `✿ *Cómo usar:*\n` +
          `!withdraw <cantidad>\n` +
          `!withdraw all - Todo el banco\n\n` +
          `📝 *Ejemplo:*\n` +
          `!withdraw 5000`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      await ctx.reply(`👑 *Eres dueño*, tienes dinero infinito!`);
      return;
    }

    const bankBalance = await serviceManager.userService.getBankBalance(ctx.sender.jid);

    let amount: number;

    if (amountStr === 'all' || amountStr === 'todo') {
      amount = bankBalance;
    } else {
      amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply(`❌ Cantidad inválida`);
        return;
      }
    }

    if (bankBalance < amount) {
      await ctx.reply(
        `❌ *No tienes suficiente en el banco*\n\n` +
          `🏦 Tienes: $${formatNumber(bankBalance)}\n` +
          `💸 Intentaste retirar: $${formatNumber(amount)}`,
      );
      return;
    }

    await serviceManager.userService.removeBank(ctx.sender.jid, amount);
    await serviceManager.userService.addMoney(ctx.sender.jid, amount);

    const newMoney = user.money + amount;
    const newBank = bankBalance - amount;

    await ctx.reply(
      `🏦 *RETIRADO!* 🏦\n\n` +
        `💰 Retiraste: $${formatNumber(amount)}\n\n` +
        `📊 *Nuevo balance:*\n` +
        `💵 Efectivo: $${formatNumber(newMoney)}\n` +
        `🏦 Banco: $${formatNumber(newBank)}\n\n` +
        `💡 *Tip:* Guarda dinero en el banco para que no te lo roben.`,
    );

    await ctx.react('✅');
  }
}
