/**
 * DiceCommand.ts
 *
 * game command `dice` — Juega a los dados
 * Usage: !dice <1-6> <cantidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { validateBetAmount } from '@/utils/validators.js';
import { config } from '@/config/index.js';

/** Command handler for `!dice`: Juega a los dados. */
export class DiceCommand extends Command {
  name = 'dice';
  description = 'Juega a los dados';
  category = CommandCategory.GAME;
  requiresRegistration = true;
  aliases = ['dados', 'dado'];
  usage = '!dice <1-6> <cantidad>';
  examples = ['!dice 6 500', '!dados 3 100'];
  cooldown = 3000;
  parallelizable = true;

  async execute(ctx: MessageContext): Promise<void> {
    const choiceStr = ctx.args[0];
    const amountStr = ctx.args[1];
    const choice = parseInt(choiceStr);
    const amount = parseInt(amountStr);

    if (!choiceStr || isNaN(choice) || choice < 1 || choice > 6) {
      await ctx.reply(
        `🎲 *DADOS* 🎲\n\n` +
          `✿ *Cómo jugar:*\n` +
          `!dice <número> <cantidad>\n\n` +
          `📊 *Multiplicador:* 6x\n\n` +
          `💰 Límites: $${config.economy.minBet} - $${config.economy.maxBet.toLocaleString()}\n\n` +
          `📝 *Ejemplo:*\n` +
          `!dice 6 500`,
      );
      return;
    }

    if (!amountStr || isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Cantidad inválida');
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!user.isOwner) {
      if (user.money < amount) {
        const bankBalance = user.bank || 0;
        if (bankBalance > 0) {
          await ctx.reply(
            `❌ *No tienes efectivo suficiente*\n\n` +
              `💵 Efectivo: $${user.money.toLocaleString()}\n` +
              `🏦 Banco: $${bankBalance.toLocaleString()}\n\n` +
              `✿ *Retira dinero primero:*\n` +
              `!withdraw ${amount - user.money}`,
          );
        } else {
          await ctx.reply(
            `❌ *No tienes suficiente dinero*\n\n` +
              `💵 Efectivo: $${user.money.toLocaleString()}\n` +
              `💸 Necesitas: $${amount.toLocaleString()}`,
          );
        }
        return;
      }

      const validation = validateBetAmount(amount, user.money, {
        minBet: config.economy.minBet,
        maxBet: config.economy.maxBet,
      });

      if (!validation.valid) {
        await ctx.reply(validation.error || '❌ Apuesta inválida');
        return;
      }
    }

    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const rolled = Math.floor(Math.random() * 6) + 1;
    const won = rolled === choice;
    const multiplier = 6;
    const winAmount = won ? Math.floor(amount * multiplier) : 0;
    const profit = winAmount - amount;

    if (!user.isOwner) {
      if (profit > 0) {
        await serviceManager.userService.addMoney(ctx.sender.jid, profit);
      } else {
        await serviceManager.userService.removeMoney(ctx.sender.jid, amount);
      }
    }

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🎲 *DADOS* 🎲\n\n`;
    message += `🎯 *Elegiste:* ${choice} ${diceEmojis[choice - 1]}\n`;
    message += `🎲 *Salió:* ${rolled} ${diceEmojis[rolled - 1]}\n\n`;

    if (won) {
      message += `✨ *GANASTE!*\n`;
      message += `💰 Apostaste: $${amount.toLocaleString()}\n`;
      message += `🎉 Ganaste: $${winAmount.toLocaleString()}\n`;
      message += `📈 Profit: +$${profit.toLocaleString()}`;
    } else {
      message += `💔 *PERDISTE*\n`;
      message += `💰 Perdiste: $${amount.toLocaleString()}`;
    }

    if (!user.isOwner) {
      message += `\n\n💵 Balance: $${updatedUser.money.toLocaleString()}`;
    }

    await ctx.reply(message);
    await ctx.react(won ? '🎉' : '💔');
  }
}
