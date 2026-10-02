/**
 * RouletteCommand.ts
 *
 * game command `roulette` — Juega a la ruleta
 * Usage: !roulette <rojo|negro|verde|par|impar> <cantidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { validateBetAmount } from '@/utils/validators.js';
import { config } from '@/config/index.js';

/** Command handler for `!roulette`: Juega a la ruleta. */
export class RouletteCommand extends Command {
  name = 'roulette';
  description = 'Juega a la ruleta';
  category = CommandCategory.GAME;
  requiresRegistration = true;
  aliases = ['ruleta'];
  usage = '!roulette <rojo|negro|verde|par|impar> <cantidad>';
  examples = ['!roulette rojo 500', '!ruleta verde 100'];
  cooldown = 5000;
  parallelizable = true;

  private readonly RED_NUMBERS = [
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ];
  private readonly BLACK_NUMBERS = [
    2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const choices = ctx.args[0]?.toLowerCase();
    const amountStr = ctx.args[1];
    const amount = parseInt(amountStr);

    const validChoices = [
      'rojo',
      'ro',
      'red',
      'negro',
      'ne',
      'black',
      'verde',
      've',
      'green',
      '0',
      'verde',
      'par',
      'par',
      'even',
      'impar',
      'odd',
    ];
    const choiceMap: Record<string, string> = {
      rojo: 'rojo',
      ro: 'rojo',
      red: 'rojo',
      negro: 'negro',
      ne: 'negro',
      black: 'negro',
      verde: 'verde',
      ve: 'verde',
      green: 'verde',
      '0': 'verde',
      par: 'par',
      even: 'par',
      impar: 'impar',
      odd: 'impar',
    };

    if (!choices || !validChoices.includes(choices)) {
      await ctx.reply(
        `🎰 *RULETA* 🎰\n\n` +
          `✿ *Cómo jugar:*\n` +
          `!roulette <opción> <cantidad>\n\n` +
          `📊 *Opciones y multiplicadores:*\n` +
          `🔴 Rojo    → 2x\n` +
          `⚫ Negro   → 2x\n` +
          `🟢 Verde   → 14x\n` +
          `🔢 Par     → 2x\n` +
          `🔢 Impar   → 2x\n\n` +
          `💰 Límites: $${config.economy.minBet} - $${config.economy.maxBet.toLocaleString()}\n\n` +
          `📝 *Ejemplo:*\n` +
          `!roulette rojo 500`,
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

    const selectedOption = choiceMap[choices] || choices;

    const spinNumber = Math.floor(Math.random() * 37);
    const isRed = this.RED_NUMBERS.includes(spinNumber);
    const isBlack = this.BLACK_NUMBERS.includes(spinNumber);
    const isGreen = spinNumber === 0;
    const isEven = spinNumber % 2 === 0 && spinNumber !== 0;
    const isOdd = spinNumber % 2 === 1;

    let multiplier = 0;
    let won = false;

    if (selectedOption === 'rojo' && isRed) {
      multiplier = 2;
      won = true;
    } else if (selectedOption === 'negro' && isBlack) {
      multiplier = 2;
      won = true;
    } else if (selectedOption === 'verde' && isGreen) {
      multiplier = 14;
      won = true;
    } else if (selectedOption === 'par' && isEven) {
      multiplier = 2;
      won = true;
    } else if (selectedOption === 'impar' && isOdd) {
      multiplier = 2;
      won = true;
    }

    const winAmount = won ? Math.floor(amount * multiplier) : 0;
    const profit = winAmount - amount;

    if (!user.isOwner) {
      if (profit > 0) {
        await serviceManager.userService.addMoney(ctx.sender.jid, profit);
      } else {
        await serviceManager.userService.removeMoney(ctx.sender.jid, amount);
      }
    }

    const color = isGreen ? '🟢' : isRed ? '🔴' : '⚫';
    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🎰 *RULETA* 🎰\n\n`;
    message += `🎯 *Número:* ${color} ${spinNumber}\n`;
    message += `📊 *Elegiste:* ${selectedOption}\n\n`;

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
