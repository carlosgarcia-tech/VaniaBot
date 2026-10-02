/**
 * SpinCommand.ts
 *
 * economy command `spin` — Ruleta diaria gratis
 * Usage: !spin
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const spinCooldowns = new Map<string, number>();
const SPIN_COOLDOWN = 4 * 60 * 60 * 1000;

/** Command handler for `!spin`: Ruleta diaria gratis. */
export class SpinCommand extends Command {
  name = 'spin';
  description = 'Ruleta diaria gratis';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['girar', 'ruleta diaria'];
  usage = '!spin';
  cooldown = 4 * 60 * 60 * 1000;

  private readonly PRIZES = [
    { prize: 50, emoji: '🪙', weight: 0.22 },
    { prize: 100, emoji: '💵', weight: 0.2 },
    { prize: 150, emoji: '💴', weight: 0.18 },
    { prize: 250, emoji: '💰', weight: 0.15 },
    { prize: 400, emoji: '💳', weight: 0.1 },
    { prize: 600, emoji: '🎁', weight: 0.07 },
    { prize: 800, emoji: '✨', weight: 0.04 },
    { prize: 1200, emoji: '🌟', weight: 0.025 },
    { prize: 2500, emoji: '💎', weight: 0.012 },
    { prize: 5000, emoji: '👑', weight: 0.003 },
  ];

  private lastPrize?: string;

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastSpin = spinCooldowns.get(ctx.sender.jid);

    if (lastSpin && now - lastSpin < SPIN_COOLDOWN) {
      const remaining = Math.ceil((SPIN_COOLDOWN - (now - lastSpin)) / 60000);
      await ctx.reply(
        `🎰 *YA GIRASTE*\n\n` +
          `Tu próximo giro gratuito es en *${remaining} horas*\n\n` +
          `💡 *Mientras tanto:*\n` +
          `• !daily - Recompensa diaria\n` +
          `• !work - Trabajar\n` +
          `• !beg - Pedir limosna`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      const reward = 10000;
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      await ctx.reply(
        `🎰 *SPIN DIARIO* 🎰\n\n` +
          `👑 *Dueño:* Ganaste el jackpot!\n` +
          `💰 +$${reward.toLocaleString()}`,
      );
      await ctx.react('👑');
      return;
    }

    const rand = Math.random();
    let cumulative = 0;
    let prize = this.PRIZES[this.PRIZES.length - 1];

    for (const p of this.PRIZES) {
      cumulative += p.weight;
      if (rand <= cumulative) {
        prize = p;
        break;
      }
    }

    await serviceManager.userService.addMoney(ctx.sender.jid, prize.prize);
    spinCooldowns.set(ctx.sender.jid, now);

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    const isBigWin = prize.prize >= 2000;

    await ctx.reply(
      `🎰 *SPIN DIARIO* 🎰\n\n` +
        `🎉 *RUEDA RUEDA RUEDA...*\n\n` +
        `⭐ *RESULTADO:* ${prize.emoji}\n\n` +
        `💰 *GANASTE:* $${prize.prize.toLocaleString()}\n\n` +
        `💵 Balance: $${updatedUser.money.toLocaleString()}\n\n` +
        `⏰ *Próximo spin gratuito:* 4 horas\n\n` +
        `💡 *Gana más:*\n` +
        `• !daily - $1500+ diario\n` +
        `• !work - Trabajar`,
    );

    await ctx.react(isBigWin ? '🎉' : '🎰');
  }
}
