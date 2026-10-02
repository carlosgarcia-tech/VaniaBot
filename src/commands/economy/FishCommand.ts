/**
 * FishCommand.ts
 *
 * economy command `fish` — Pescar para ganar dinero
 * Usage: !fish
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const fishCooldowns = new Map<string, number>();
const FISH_COOLDOWN = 2 * 60 * 1000;

/** Command handler for `!fish`: Pescar para ganar dinero. */
export class FishCommand extends Command {
  name = 'fish';
  description = 'Pescar para ganar dinero';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['pescar', 'fishing'];
  usage = '!fish';
  cooldown = 120000;

  private readonly FISH = [
    { name: 'sardina', min: 1, max: 10, emoji: '🐟', rarity: 0.35 },
    { name: 'caballa', min: 5, max: 25, emoji: '🐠', rarity: 0.28 },
    { name: 'atún', min: 15, max: 50, emoji: '🐟', rarity: 0.18 },
    { name: 'salmón', min: 30, max: 100, emoji: '🐟', rarity: 0.1 },
    { name: 'tiburón', min: 100, max: 300, emoji: '🦈', rarity: 0.05 },
    { name: 'pez dorado', min: 500, max: 1500, emoji: '🐠', rarity: 0.025 },
    { name: 'ballena', min: 2000, max: 8000, emoji: '🐋', rarity: 0.015 },
    { name: 'kraken', min: 10000, max: 25000, emoji: '🦑', rarity: 0.005 },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastFish = fishCooldowns.get(ctx.sender.jid);

    if (lastFish && now - lastFish < FISH_COOLDOWN) {
      const remaining = Math.ceil((FISH_COOLDOWN - (now - lastFish)) / 60000);
      await ctx.reply(
        `🎣 *EN ENSAYO*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de volver a pescar.`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      const reward = Math.floor(Math.random() * 10000) + 5000;
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      await ctx.reply(
        `🎣 *PESCA* 🎣\n\n` +
          `👑 *Dueño:* Pescaste una ballena mítica!\n` +
          `💰 +$${reward.toLocaleString()}`,
      );
      await ctx.react('👑');
      return;
    }

    const rand = Math.random();
    let cumulative = 0;
    let caught = this.FISH[this.FISH.length - 1];

    for (const fish of this.FISH) {
      cumulative += fish.rarity;
      if (rand <= cumulative) {
        caught = fish;
        break;
      }
    }

    const earned = Math.floor(Math.random() * (caught.max - caught.min + 1)) + caught.min;

    await serviceManager.userService.addMoney(ctx.sender.jid, earned);
    fishCooldowns.set(ctx.sender.jid, now);

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    const rarityText = caught.rarity <= 0.05 ? '✨ RARO!' : '';

    await ctx.reply(
      `🎣 *PESCA* 🎣\n\n` +
        `${caught.emoji} *${caught.name.toUpperCase()}*\n\n` +
        `💰 *+$${earned.toLocaleString()}*\n` +
        `${rarityText}\n\n` +
        `💵 Balance: $${updatedUser.money.toLocaleString()}\n\n` +
        `⏰ Intenta de nuevo en 2 minutos`,
    );

    await ctx.react(caught.rarity <= 0.1 ? '✨' : '🎣');
  }
}
