/**
 * DailyCommand.ts
 *
 * economy command `daily` — Recompensa diaria mejorada
 * Usage: !daily
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber, formatTime } from '@/utils/helpers.js';
import { errorHandler } from '@/utils/ErrorHandler.js';
import { logError } from '@/utils/logger.js';
import { achievementService } from '@/services/rpg/AchievementService.js';

/** Command handler for `!daily`: Recompensa diaria mejorada. */
export class DailyCommand extends Command {
  name = 'daily';
  description = 'Recompensa diaria mejorada';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['daily', 'diario'];
  usage = '!daily';
  cooldown = 1000;

  private readonly BASE_REWARD = 1500;
  private readonly STREAK_BONUS = 150;
  private readonly MAX_STREAK_BONUS = 3000;
  private readonly XP_REWARD = 75;

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);

      if (!this.canClaim(user.lastDaily)) {
        const remaining = this.getTimeRemaining(user.lastDaily);
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *ya lo tienes* ˚₊· ͟͟͞͞➳\n\n` +
            `✿ Vuelve en: *${formatTime(remaining)}*\n\n` +
            `♡ Te espero ♡`,
        );
        return;
      }

      const streak = this.calculateStreak(user.lastDaily);
      const streakBonus = Math.min(streak * this.STREAK_BONUS, this.MAX_STREAK_BONUS);
      let totalReward = this.BASE_REWARD + streakBonus;

      const dailyBonusBuff = user.activeBuffs?.find(
        b => b.buffId === 'daily_bonus' && b.expiresAt > Date.now(),
      );
      if (dailyBonusBuff) {
        const bonusAmount = Math.floor(totalReward * (dailyBonusBuff.value / 100));
        totalReward += bonusAmount;
      }

      const xpBuff = user.activeBuffs?.find(
        b => b.buffId === 'xp_boost' && b.expiresAt > Date.now(),
      );
      const xpMultiplier = xpBuff ? xpBuff.value : 1;

      await serviceManager.userService.addMoney(ctx.sender.jid, totalReward);
      await serviceManager.userService.updateUser(ctx.sender.jid, {
        lastDaily: Date.now(),
      });

      try {
        await achievementService.trackDaily(ctx.sender.jid);
        await achievementService.checkLevelAchievements(ctx.sender.jid);
        await achievementService.checkMoneyAchievements(ctx.sender.jid);
      } catch (error) {
        logError('[DailyCommand]', error);
      }

      const xpGained = Math.floor(this.XP_REWARD * xpMultiplier);
      await serviceManager.levelService.addXP(ctx.sender.jid, xpGained);

      const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

      let bonusText = '';
      if (streak >= 7) bonusText = '\n🔥 *BONUS SEMANAL!* +$500';
      if (streak >= 30) bonusText = '\n⭐ *BONUS MENSUAL!* +$2000';
      if (dailyBonusBuff)
        bonusText += `\n🎁 *BONUS DIARIO:* +${Math.floor(totalReward * (dailyBonusBuff.value / 100))}`;
      if (xpBuff) bonusText += `\n✨ *BONUS XP:* +${xpBuff.value}%`;

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *para ti* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *+$${formatNumber(totalReward)}* moneditas\n` +
          `✩ racha: *${streak}* días\n` +
          `✿ *+${xpGained} XP*${bonusText}\n\n` +
          `♡ tu saldo: *$${formatNumber(updatedUser.money)}* ♡`,
      );
    } catch (error) {
      const message = errorHandler.handleCommandError(error, 'daily', {
        userId: ctx.sender.jid,
        groupId: ctx.chat.isGroup ? ctx.chat.jid : undefined,
      });
      await ctx.reply(message).catch((error: unknown) => logError('[DailyCommand]', error));
    }
  }

  private canClaim(lastDaily?: number): boolean {
    if (!lastDaily) return true;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - lastDaily >= oneDayMs;
  }

  private getTimeRemaining(lastDaily?: number): number {
    if (!lastDaily) return 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const remaining = lastDaily + oneDayMs - Date.now();
    return Math.max(0, remaining);
  }

  private calculateStreak(lastDaily?: number): number {
    if (!lastDaily) return 1;

    const daysSince = Math.floor((Date.now() - lastDaily) / (24 * 60 * 60 * 1000));

    if (daysSince > 2) return 1;

    if (daysSince === 1) return 2;

    return 1;
  }
}
