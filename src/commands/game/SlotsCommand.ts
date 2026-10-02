/**
 * SlotsCommand.ts
 *
 * game command `slots` — Play slot machine and win money
 * Usage: !slots <bet>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { validateBetAmount } from '@/utils/validators.js';
import { config } from '@/config/index.js';

/** Command handler for `!slots`: Play slot machine and win money. */
export class SlotsCommand extends Command {
  name = 'slots';
  description = 'Play slot machine and win money';
  category = CommandCategory.GAME;
  requiresRegistration = true;
  aliases = ['slot', 'tragamonas'];
  usage = '!slots <bet>';
  examples = ['!slots 100', '!slots 500'];
  cooldown = 5000;

  private readonly SYMBOLS = ['🍒', '🍋', '🔔', '💎', '7️⃣', '⭐'];
  private readonly PAYOUTS: { [key: string]: number } = {
    '7️⃣7️⃣7️⃣': 10,
    '💎💎💎': 8,
    '🔔🔔🔔': 5,
    '⭐⭐⭐': 4,
    '🍋🍋🍋': 3,
    '🍒🍒🍒': 3,
    match2: 1.5,
  };

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, cuánto quieres apostar?* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!slots* <cantidad>\n` +
          `✩ ejemplo: *!slots 100*`,
      );
      return;
    }

    const bet = parseInt(ctx.args[0]);

    if (isNaN(bet) || bet <= 0) {
      await ctx.reply('❌ Invalid bet amount');
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!user.isOwner) {
      if (user.money < bet) {
        const bankBalance = user.bank || 0;
        if (bankBalance > 0) {
          await ctx.reply(
            `❌ *No tienes efectivo suficiente*\n\n` +
              `💵 Efectivo: $${user.money.toLocaleString()}\n` +
              `🏦 Banco: $${bankBalance.toLocaleString()}\n\n` +
              `✿ *Retira dinero primero:*\n` +
              `!withdraw ${bet - user.money}`,
          );
        } else {
          await ctx.reply(
            `❌ *No tienes suficiente dinero*\n\n` +
              `💵 Efectivo: $${user.money.toLocaleString()}\n` +
              `💸 Necesitas: $${bet.toLocaleString()}`,
          );
        }
        return;
      }

      const validation = validateBetAmount(bet, user.money, {
        minBet: config.economy.minBet,
        maxBet: config.economy.maxBet,
      });

      if (!validation.valid) {
        await ctx.reply(validation.error || '❌ Apuesta inválida');
        return;
      }
    }

    await ctx.react('🎰');

    const slot1 = this.getRandomSymbol();
    const slot2 = this.getRandomSymbol();
    const slot3 = this.getRandomSymbol();

    const result = `${slot1}${slot2}${slot3}`;

    let multiplier = 0;
    let resultText = '';

    if (this.PAYOUTS[result]) {
      multiplier = this.PAYOUTS[result];
      resultText = this.getResultText(result);
    } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
      multiplier = this.PAYOUTS['match2'];
      resultText = 'Two Match!';
    } else {
      multiplier = 0;
      resultText = 'No Match';
    }

    const winAmount = Math.floor(bet * multiplier);
    const profit = winAmount - bet;

    if (!user.isOwner) {
      if (profit > 0) {
        await serviceManager.userService.addMoney(ctx.sender.jid, profit);
      } else {
        await serviceManager.userService.removeMoney(ctx.sender.jid, bet);
      }
    }

    let message = `🎰 *SLOT MACHINE*\n\n`;
    message += `╔═══════════╗\n`;
    message += `║  ${slot1}   │  ${slot2}  │   ${slot3}      ║\n`;
    message += `╚═══════════╝\n\n`;

    if (multiplier > 0) {
      message += `✨ *${resultText}*\n`;
      message += `💰 Bet: $${bet.toLocaleString()}\n`;
      message += `🎉 Win: $${winAmount.toLocaleString()}\n`;
      message += `📈 Profit: +$${profit.toLocaleString()}`;

      if (user.isOwner) {
        message += ` 👑`;
      }
    } else {
      message += `💔 *${resultText}*\n`;
      message += `💰 Lost: $${bet.toLocaleString()}`;

      if (user.isOwner) {
        message += ` 👑\n(Owner: No real loss)`;
      }
    }

    if (!user.isOwner) {
      const newBalance = await serviceManager.userService.getUser(ctx.sender.jid);
      message += `\n\n💵 Balance: $${newBalance.money.toLocaleString()}`;
    }

    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += `\n\n${footer}`;

    await ctx.reply(message);
    await ctx.react(multiplier > 0 ? '🎉' : '💔');
  }

  private getRandomSymbol(): string {
    return this.SYMBOLS[Math.floor(Math.random() * this.SYMBOLS.length)];
  }

  private getResultText(result: string): string {
    switch (result) {
      case '7️⃣7️⃣7️⃣':
        return 'JACKPOT! Triple 7!';
      case '💎💎💎':
        return 'MEGA WIN! Triple Diamond!';
      case '🔔🔔🔔':
        return 'BIG WIN! Triple Bell!';
      case '⭐⭐⭐':
        return 'Great! Triple Star!';
      case '🍋🍋🍋':
        return 'Nice! Triple Lemon!';
      case '🍒🍒🍒':
        return 'Good! Triple Cherry!';
      default:
        return 'Win!';
    }
  }
}
