/**
 * TopCommand.ts
 *
 * utility command `top` — Displays the bot leaderboards
 * Usage: !top [money|level|xp]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import type { User } from '@/services/database/UserService.js';

/** Command handler for `!top`: Displays the bot leaderboards. */
export class TopCommand extends Command {
  name = 'top';
  description = 'Displays the bot leaderboards';
  category = CommandCategory.UTILITY;
  requiresRegistration = true;
  aliases = ['leaderboard', 'lb'];
  usage = '!top [money|level|xp]';
  examples = ['!top', '!top money', '!top level'];
  cooldown = 10000;

  async execute(ctx: MessageContext): Promise<void> {
    const type = ctx.args[0]?.toLowerCase() || 'level';

    let users: User[];
    let title: string;
    let formatter: (user: User) => string;

    switch (type) {
      case 'money':
        users = await serviceManager.userService.getTopByMoney(10);
        title = 'TOP 10 - RICHEST';
        formatter = (u: User) => `$${formatNumber(u.money)}`;
        break;

      case 'xp':
        users = await serviceManager.userService.getTopByXP(10);
        title = 'TOP 10 - MOST XP';
        formatter = (u: User) => `${formatNumber(u.xp)} XP`;
        break;

      case 'level':
      default:
        users = await serviceManager.userService.getTopByLevel(10);
        title = 'TOP 10 - HIGHEST LEVEL';
        formatter = (u: User) => `Level ${u.level} (${formatNumber(u.xp)} XP)`;
        break;
    }

    if (users.length === 0) {
      await ctx.reply('No leaderboard data available yet.');
      return;
    }

    let message = `*${title}*\n\n`;

    users.forEach((user, index) => {
      const position = index + 1;
      const name = user.name || 'Unknown';
      const level = user.level ?? 1;
      const xp = user.xp ?? 0;
      const money = user.money ?? 0;
      message += `**${position}.** ${name}\n`;
      message += `   ${formatter({ ...user, level, xp, money } as User)}\n\n`;
    });

    message += `Tip: Use !top money | !top level | !top xp`;

    await ctx.reply(message.trim());
  }
}
