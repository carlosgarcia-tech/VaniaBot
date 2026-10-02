/**
 * WeeklyCommand.ts
 *
 * economy command `weekly` — Recompensa semanal mejorada
 * Usage: !weekly
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { formatNumber } from '@/utils/helpers.js';

/** Command handler for `!weekly`: Recompensa semanal mejorada. */
export class WeeklyCommand extends Command {
  name = 'weekly';
  description = 'Recompensa semanal mejorada';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['semanal', 'weekly'];
  usage = '!weekly';
  examples = ['!weekly'];
  cooldown = 5000;

  private readonly BASE_REWARD = 15000;
  private readonly STREAK_BONUS = 1000;
  private readonly MAX_STREAK_BONUS = 15000;
  private readonly XP_REWARD = 350;

  async execute(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!serviceManager.userService.canClaimWeekly(user) && !user.isOwner) {
      const remaining = serviceManager.userService.getWeeklyTimeRemaining(user);
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *tu regalito semanal* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ ya lo tienes guardado\n` +
          `✿ puedes volver en: *${days}d ${hours}h*\n\n` +
          `♡ te espero ♡`,
      );
      return;
    }

    await ctx.react('⏳');

    let reward = this.BASE_REWARD;
    const streak = (user.weeklyStreak || 0) + 1;
    const streakBonus = Math.min(streak * this.STREAK_BONUS, this.MAX_STREAK_BONUS);

    if (!user.isOwner) {
      reward += streakBonus;

      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      await serviceManager.userService.addXP(ctx.sender.jid, this.XP_REWARD);

      await serviceManager.userService.updateWeeklyClaim(ctx.sender.jid, streak);
    }

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    let bonusText = '';
    if (streak >= 4) bonusText = '\n🎰 *+1 TICKET DE LOTERÍA!*';

    let message = `🎁 *RECOMPENSA SEMANAL* 🎁\n\n`;
    message += `💰 Base: $${this.BASE_REWARD.toLocaleString()}\n`;

    if (streak > 1) {
      message += `🔥 Bonus racha: $${streakBonus.toLocaleString()} (${streak} semanas)\n`;
    }

    if (!user.isOwner) {
      message += `💵 Total: $${reward.toLocaleString()}\n`;
      message += `✨ XP: +${this.XP_REWARD}${bonusText}\n\n`;
      message += `💰 Balance: $${formatNumber(updatedUser.money)}\n`;
      message += `🔥 Racha: ${streak} semana${streak > 1 ? 's' : ''}\n\n`;
    } else {
      message += `\n👑 *Dueño:* Recompensas infinitas\n\n`;
    }

    message += `📅 Próxima: 7 días\n\n`;
    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += footer;

    await ctx.reply(message);
    await ctx.react('✅');
  }
}
