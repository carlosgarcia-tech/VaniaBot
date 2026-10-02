/**
 * MineCommand.ts
 *
 * economy command `mine` — Minar criptomonedas
 * Usage: !mine
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const mineCooldowns = new Map<string, number>();
const MINE_COOLDOWN = 5 * 60 * 1000;

/** Command handler for `!mine`: Minar criptomonedas. */
export class MineCommand extends Command {
  name = 'mine';
  description = 'Minar criptomonedas';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['minar', 'mining'];
  usage = '!mine';
  cooldown = 300000;

  private readonly ORES = [
    { name: 'carbón', min: 20, max: 80, emoji: '⬛', rarity: 0.3 },
    { name: 'hierro', min: 50, max: 150, emoji: '⚪', rarity: 0.25 },
    { name: 'plata', min: 100, max: 300, emoji: '⚙️', rarity: 0.18 },
    { name: 'oro', min: 300, max: 800, emoji: '🟡', rarity: 0.12 },
    { name: 'rubí', min: 600, max: 1500, emoji: '🔴', rarity: 0.08 },
    { name: 'esmeralda', min: 1000, max: 2500, emoji: '🟢', rarity: 0.05 },
    { name: 'diamante', min: 3000, max: 8000, emoji: '💎', rarity: 0.015 },
    { name: 'oro negro', min: 8000, max: 20000, emoji: '🌑', rarity: 0.005 },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastMine = mineCooldowns.get(ctx.sender.jid);

    if (lastMine && now - lastMine < MINE_COOLDOWN) {
      const remaining = Math.ceil((MINE_COOLDOWN - (now - lastMine)) / 60000);
      await ctx.reply(
        `⛏️ *EN ENSAYO*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de volver a minar.`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      const reward = Math.floor(Math.random() * 20000) + 10000;
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      await ctx.reply(
        `⛏️ *MINAR* ⛏️\n\n` +
          `👑 *Dueño:* Encontraste un yacimiento de oro negro!\n` +
          `💰 +$${reward.toLocaleString()}`,
      );
      await ctx.react('👑');
      return;
    }

    const rand = Math.random();
    let cumulative = 0;
    let ore = this.ORES[this.ORES.length - 1];

    for (const o of this.ORES) {
      cumulative += o.rarity;
      if (rand <= cumulative) {
        ore = o;
        break;
      }
    }

    const earned = Math.floor(Math.random() * (ore.max - ore.min + 1)) + ore.min;

    await serviceManager.userService.addMoney(ctx.sender.jid, earned);
    mineCooldowns.set(ctx.sender.jid, now);

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    const rarityText = ore.rarity <= 0.05 ? '✨ RARO!' : '';
    const isValuable = ore.rarity <= 0.1;

    await ctx.reply(
      `⛏️ *MINAR* ⛏️\n\n` +
        `${ore.emoji} *${ore.name.toUpperCase()}*\n\n` +
        `💰 *+$${earned.toLocaleString()}*\n` +
        `${rarityText}\n\n` +
        `💵 Balance: $${updatedUser.money.toLocaleString()}\n\n` +
        `⏰ Intenta de nuevo en 5 minutos`,
    );

    await ctx.react(isValuable ? '✨' : '⛏️');
  }
}
