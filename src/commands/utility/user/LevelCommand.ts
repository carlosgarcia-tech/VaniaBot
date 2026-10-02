/**
 * LevelCommand.ts
 *
 * utility command `level` — Check your or someone else's level
 * Usage: !level [@user]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';

/** Command handler for `!level`: Check your or someone else's level. */
export class LevelCommand extends Command {
  name = 'level';
  description = "Check your or someone else's level";
  category = CommandCategory.UTILITY;
  requiresRegistration = true;
  aliases = ['lvl', 'nivel', 'xp'];
  usage = '!level [@user]';
  examples = ['!level', '!level @user', '!lvl'];
  cooldown = 3000;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;

    const targetJid = mentionedJid || ctx.sender.jid;
    const targetUser = await serviceManager.userService.getUser(targetJid);

    const isSelf = targetJid === ctx.sender.jid;
    const isOwner = targetUser.isOwner;

    let message = '';

    if (isSelf) {
      message = `📊 *Your Level Stats*\n\n`;
    } else {
      message = `📊 *${targetUser.name}'s Level Stats*\n\n`;
    }

    let roleIcon = '✨';
    if (isOwner) roleIcon = '♛';
    else if (targetUser.level >= 100) roleIcon = '👑';
    else if (targetUser.level >= 50) roleIcon = '💎';
    else if (targetUser.level >= 25) roleIcon = '🌟';
    else if (targetUser.level >= 10) roleIcon = '⭐';

    message += `${roleIcon} *Level:* ${targetUser.level}\n`;

    if (isOwner) {
      message += `✨ *XP:* ${targetUser.xp.toLocaleString()} ♾️\n`;
      message += `\n👑 *Owner Status:* Max level`;
    } else {
      const requiredXP = serviceManager.levelService.getRequiredXP(targetUser.level);
      const currentLevelXP = targetUser.xp;
      const progress = Math.min((currentLevelXP / requiredXP) * 100, 100);

      message += `✨ *XP:* ${currentLevelXP.toLocaleString()} / ${requiredXP.toLocaleString()}\n`;

      const progressBar = this.createProgressBar(progress);
      message += `\n${progressBar} ${progress.toFixed(1)}%\n`;

      const xpNeeded = requiredXP - currentLevelXP;
      if (xpNeeded > 0) {
        message += `\n🎯 Next Level: ${xpNeeded.toLocaleString()} XP needed`;
      }
    }

    const allUsers = await serviceManager.userService.getAllUsers();
    const sortedByLevel = allUsers
      .filter(u => !u.isOwner)
      .sort((a, b) => b.level - a.level || b.xp - a.xp);

    const rank = sortedByLevel.findIndex(u => u.jid === targetJid) + 1;

    if (rank > 0) {
      message += `\n📊 Rank: #${rank} of ${sortedByLevel.length}`;
    }

    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += `\n\n${footer}`;

    await ctx.reply(message);
  }

  private createProgressBar(percentage: number, length: number = 10): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '▰'.repeat(filled) + '▱'.repeat(empty);
  }
}
