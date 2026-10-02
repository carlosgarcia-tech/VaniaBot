/**
 * HuntCommand.ts
 *
 * economy command `hunt` — Cazar animales para ganar dinero
 * Usage: !hunt
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const huntCooldowns = new Map<string, number>();
const HUNT_COOLDOWN = 3 * 60 * 1000;

/** Command handler for `!hunt`: Cazar animales para ganar dinero. */
export class HuntCommand extends Command {
  name = 'hunt';
  description = 'Cazar animales para ganar dinero';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['cazar', 'hunting'];
  usage = '!hunt';
  cooldown = 180000;

  private readonly ANIMALS = [
    { name: 'conejo', min: 1, max: 15, emoji: '🐰', rarity: 0.3 },
    { name: 'zorro', min: 10, max: 40, emoji: '🦊', rarity: 0.25 },
    { name: 'pájaro', min: 5, max: 30, emoji: '🐦', rarity: 0.18 },
    { name: 'ciervo', min: 25, max: 80, emoji: '🦌', rarity: 0.12 },
    { name: 'jabalí', min: 50, max: 150, emoji: '🐗', rarity: 0.08 },
    { name: 'lobo', min: 100, max: 300, emoji: '🐺', rarity: 0.04 },
    { name: 'oso', min: 300, max: 800, emoji: '🐻', rarity: 0.02 },
    { name: 'tigre', min: 1000, max: 3000, emoji: '🐯', rarity: 0.008 },
    { name: 'unicornio', min: 5000, max: 15000, emoji: '🦄', rarity: 0.002 },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastHunt = huntCooldowns.get(ctx.sender.jid);

    if (lastHunt && now - lastHunt < HUNT_COOLDOWN) {
      const remaining = Math.ceil((HUNT_COOLDOWN - (now - lastHunt)) / 60000);
      await ctx.reply(
        `🏃 *EN ENSAYO*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de volver a cazar.`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      const reward = Math.floor(Math.random() * 15000) + 8000;
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      await ctx.reply(
        `🏃 *CAZA* 🏃\n\n` +
          `👑 *Dueño:* Cazaste un dragón legendario!\n` +
          `💰 +$${reward.toLocaleString()}`,
      );
      await ctx.react('👑');
      return;
    }

    const rand = Math.random();
    let cumulative = 0;
    let caught = this.ANIMALS[this.ANIMALS.length - 1];

    for (const animal of this.ANIMALS) {
      cumulative += animal.rarity;
      if (rand <= cumulative) {
        caught = animal;
        break;
      }
    }

    const earned = Math.floor(Math.random() * (caught.max - caught.min + 1)) + caught.min;

    await serviceManager.userService.addMoney(ctx.sender.jid, earned);
    huntCooldowns.set(ctx.sender.jid, now);

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    const rarityText = caught.rarity <= 0.05 ? '✨ RARO!' : '';

    await ctx.reply(
      `🏃 *CAZA* 🏃\n\n` +
        `${caught.emoji} *${caught.name.toUpperCase()}*\n\n` +
        `💰 *+$${earned.toLocaleString()}*\n` +
        `${rarityText}\n\n` +
        `💵 Balance: $${updatedUser.money.toLocaleString()}\n\n` +
        `⏰ Intenta de nuevo en 3 minutos`,
    );

    await ctx.react(caught.rarity <= 0.1 ? '✨' : '🏃');
  }
}
