/**
 * WorkCommand.ts
 *
 * economy command `work` — Work to earn money
 * Usage: !work
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { achievementService } from '@/services/rpg/AchievementService.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!work`: Work to earn money. */
export class WorkCommand extends Command {
  name = 'work';
  description = 'Work to earn money';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['work'];
  usage = '!work';
  cooldown = 60 * 60 * 1000;

  private readonly JOBS = [
    { name: 'Programmer', min: 500, max: 1500, emoji: '💻' },
    { name: 'Chef', min: 300, max: 1000, emoji: '👨‍🍳' },
    { name: 'Driver', min: 200, max: 800, emoji: '🚗' },
    { name: 'Teacher', min: 400, max: 1200, emoji: '👨‍🏫' },
    { name: 'Musician', min: 250, max: 900, emoji: '🎸' },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    const incomeBuff = user.activeBuffs?.find(
      b => b.buffId === 'income_boost' && b.expiresAt > Date.now(),
    );
    const incomeMultiplier = incomeBuff ? 1 + incomeBuff.value / 100 : 1;

    const job = this.JOBS[Math.floor(Math.random() * this.JOBS.length)];
    let earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    earned = Math.floor(earned * incomeMultiplier);

    await serviceManager.userService.addMoney(ctx.sender.jid, earned);

    try {
      await achievementService.trackWork(ctx.sender.jid);
      await achievementService.checkLevelAchievements(ctx.sender.jid);
    } catch (error) {
      // El pago del trabajo ya se hizo: los logros son secundarios.
      logError(`[WorkCommand] Achievement tracking failed for ${ctx.sender.jid}`, error);
    }

    const xpBuff = user.activeBuffs?.find(b => b.buffId === 'xp_boost' && b.expiresAt > Date.now());
    const xpMultiplier = xpBuff ? 1 + xpBuff.value / 100 : 1;

    const xpGained = Math.floor((earned / 10) * xpMultiplier);
    await serviceManager.levelService.addXP(ctx.sender.jid, xpGained);

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    let bonusText = '';
    if (incomeBuff) {
      bonusText = `\n💰 *BONUS INGRESO:* +${incomeBuff.value}%`;
    }
    if (xpBuff) {
      bonusText += `\n✨ *BONUS XP:* +${xpBuff.value}%`;
    }

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *bien ahí!* ˚₊· ͟͟͞͞➳\n\n` +
        `${job.emoji} *${job.name}* 💼\n` +
        `✿ ganaste: *$${formatNumber(earned)}* moneditas${bonusText}\n` +
        `✿ +${xpGained} XP\n\n` +
        `♡ tu bolsita: *$${formatNumber(updatedUser.money)}* ♡`,
    );
  }
}
