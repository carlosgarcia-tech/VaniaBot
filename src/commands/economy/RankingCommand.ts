import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';

export class RankingCommand extends Command {
  name = 'ranking';
  description = 'Ver ranking de usuarios';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  // Sin alias 'top': es el name de TopCommand (leaderboards).
  aliases = ['rank', 'ranking'];
  usage = '!ranking [money|xp|level|networth]';
  examples = ['!ranking', '!top xp', '!top networth'];
  cooldown = 10000;

  private getNetWorth(user: { money: number; bank: number }): number {
    return user.money + user.bank;
  }

  async execute(ctx: MessageContext): Promise<void> {
    const type = ctx.args[0]?.toLowerCase() || 'networth';

    const allUsers = await serviceManager.userService.getAllUsers();

    const owners = allUsers.filter(u => u.isOwner);
    const nonOwners = allUsers.filter(u => !u.isOwner && !u.isBanned);

    let sortedNonOwners: typeof nonOwners;
    let title: string;

    switch (type) {
      case 'xp':
      case 'experience':
        sortedNonOwners = [...nonOwners].sort((a, b) => b.xp - a.xp);
        title = '🏆 *TOP XP*';
        break;
      case 'level':
      case 'nivel':
        sortedNonOwners = [...nonOwners].sort((a, b) => b.level - a.level);
        title = '⭐ *TOP NIVEL*';
        break;
      case 'money':
      case 'efectivo':
        sortedNonOwners = [...nonOwners].sort((a, b) => b.money - a.money);
        title = '💵 *TOP EFECTIVO*';
        break;
      case 'networth':
      case 'riqueza':
      default:
        sortedNonOwners = [...nonOwners].sort((a, b) => this.getNetWorth(b) - this.getNetWorth(a));
        title = '💎 *TOP RIQUEZA*';
        break;
    }

    const userRank = sortedNonOwners.findIndex(u => u.jid === ctx.sender.jid) + 1;

    let message = `${title}\n\n`;

    if (owners.length > 0 && (type === 'money' || type === 'networth' || type === 'riqueza')) {
      message += `👑 *OWNERS*\n`;
      owners.forEach(owner => {
        const netWorth = this.getNetWorth(owner);
        message += `👑 *${owner.name}*\n`;
        message += `   💎 Riqueza: $${netWorth.toLocaleString()}\n`;
        message += `   💵 Efectivo: $${owner.money.toLocaleString()}\n`;
        message += `   🏦 Banco: $${owner.bank?.toLocaleString() || 0}\n\n`;
      });
      message += `\n`;
    }

    const top10 = sortedNonOwners.slice(0, 10);
    top10.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

      switch (type) {
        case 'xp':
        case 'experience':
          message += `${medal} *${user.name}*\n`;
          message += `   XP: ${user.xp.toLocaleString()} | Nivel: ${user.level}\n\n`;
          break;
        case 'level':
        case 'nivel':
          message += `${medal} *${user.name}*\n`;
          message += `   Nivel: ${user.level} | XP: ${user.xp.toLocaleString()}\n\n`;
          break;
        case 'money':
        case 'efectivo':
          message += `${medal} *${user.name}*\n`;
          message += `   💵 $${user.money.toLocaleString()}\n\n`;
          break;
        default:
          const netWorth = this.getNetWorth(user);
          message += `${medal} *${user.name}*\n`;
          message += `   💎 $${netWorth.toLocaleString()}\n`;
          message += `   💵 $${user.money.toLocaleString()} | 🏦 $${user.bank?.toLocaleString() || 0}\n\n`;
      }
    });

    if (userRank > 0) {
      const user = sortedNonOwners[userRank - 1];
      message += `━━━━━━━\n`;
      message += `📊 *Tu posición:* #${userRank}\n`;

      switch (type) {
        case 'xp':
        case 'experience':
          message += `   XP: ${user.xp.toLocaleString()}\n`;
          break;
        case 'level':
        case 'nivel':
          message += `   Nivel: ${user.level}\n`;
          break;
        case 'money':
        case 'efectivo':
          message += `   💵 $${user.money.toLocaleString()}\n`;
          break;
        default:
          const netWorth = this.getNetWorth(user);
          message += `   💎 $${netWorth.toLocaleString()}\n`;
          message += `   💵 $${user.money.toLocaleString()} | 🏦 $${user.bank?.toLocaleString() || 0}\n`;
      }
    }

    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += `\n${footer}`;

    await ctx.reply(message);
  }
}
