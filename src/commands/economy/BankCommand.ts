/**
 * BankCommand.ts
 *
 * economy command `bank` — Ver saldo del banco
 * Usage: !bank
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { formatNumber } from '@/utils/helpers.js';

/** Command handler for `!bank`: Ver saldo del banco. */
export class BankCommand extends Command {
  name = 'bank';
  description = 'Ver saldo del banco';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['banco'];
  usage = '!bank';
  cooldown = 3000;

  async execute(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    const bankBalance = await serviceManager.userService.getBankBalance(ctx.sender.jid);
    const totalBalance = await serviceManager.userService.getTotalBalance(ctx.sender.jid);

    let message = `🏦 *TU BANCO* 🏦\n\n`;

    if (user.isOwner) {
      message += `👑 *DUEÑO DEL BOT*\n`;
      message += `💰 Cash: ∞\n`;
      message += `🏦 Banco: ∞\n`;
      message += `📊 Total: ∞\n\n`;
    } else {
      message += `💰 *Efectivo:* $${formatNumber(user.money)}\n`;
      message += `🏦 *Banco:* $${formatNumber(bankBalance)}\n`;
      message += `📊 *Total:* $${formatNumber(totalBalance)}\n\n`;

      message += `✿ *Comandos:*\n`;
      message += `• !deposit <cantidad> - Depositar\n`;
      message += `• !withdraw <cantidad> - Retirar\n`;
      message += `• !bank - Ver saldo\n\n`;

      const protection = bankBalance > 0 ? '\n🛡️ *Tu dinero está seguro en el banco!*' : '';
      message += `💡 *Tip:* Guarda dinero en el banco para que no te lo roben.${protection}`;
    }

    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += `\n\n${footer}`;

    await ctx.reply(message);
  }
}
