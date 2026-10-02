/**
 * MonthlyCommand.ts
 *
 * economy command `monthly` — Recompensa mensual exclusiva
 * Usage: !monthly
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { formatNumber } from '@/utils/helpers.js';

/** Command handler for `!monthly`: Recompensa mensual exclusiva. */
export class MonthlyCommand extends Command {
  name = 'monthly';
  description = 'Recompensa mensual exclusiva';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['mensual'];
  usage = '!monthly';
  cooldown = 5000;

  private readonly BASE_REWARD = 50000;
  private readonly XP_REWARD = 1000;

  private canClaim(lastMonthly?: number): boolean {
    if (!lastMonthly) return true;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - lastMonthly >= thirtyDaysMs;
  }

  private getTimeRemaining(lastMonthly?: number): number {
    if (!lastMonthly) return 0;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const remaining = lastMonthly + thirtyDaysMs - Date.now();
    return Math.max(0, remaining);
  }

  async execute(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!this.canClaim(user.lastMonthly) && !user.isOwner) {
      const remaining = this.getTimeRemaining(user.lastMonthly);
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      await ctx.reply(
        `🌟 *RECOMPENSA MENSUAL* 🌟\n\n` +
          `✿ Ya tienes tu regalo mensual\n\n` +
          `⏰ Próxima disponibles en:\n` +
          `*${days}d ${hours}h*\n\n` +
          `♡ Te espero ♡`,
      );
      return;
    }

    await ctx.react('⏳');

    const reward = this.BASE_REWARD;

    if (!user.isOwner) {
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      await serviceManager.levelService.addXP(ctx.sender.jid, this.XP_REWARD);

      await serviceManager.userService.updateUser(ctx.sender.jid, {
        lastMonthly: Date.now(),
      });
    }

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🌟 *RECOMPENSA MENSUAL* 🌟\n\n`;
    message += `✨ *EXCLUSIVA!* ✨\n\n`;
    message += `💰 Recompensa: $${reward.toLocaleString()}\n`;
    message += `✨ XP: +${this.XP_REWARD}\n\n`;

    if (!user.isOwner) {
      message += `💵 Nuevo balance: $${formatNumber(updatedUser.money)}\n\n`;
    } else {
      message += `👑 Dueño: Recompensas infinitas\n\n`;
    }

    message += `📅 *Disponible cada 30 días*\n\n`;
    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += footer;

    await ctx.reply(message);
    await ctx.react('✅');
  }
}
