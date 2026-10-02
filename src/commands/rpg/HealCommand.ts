/**
 * HealCommand.ts
 *
 * rpg command `heal` — Recupera tu vida
 * Usage: !heal
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const healCooldowns = new Map<string, number>();
const HEAL_COOLDOWN = 60000;

/** Command handler for `!heal`: Recupera tu vida. */
export class HealCommand extends Command {
  name = 'heal';
  description = 'Recupera tu vida';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['sanar', 'curar'];
  usage = '!heal';

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastHeal = healCooldowns.get(ctx.sender.jid);

    if (lastHeal && now - lastHeal < HEAL_COOLDOWN) {
      const remaining = Math.ceil((HEAL_COOLDOWN - (now - lastHeal)) / 1000);
      await ctx.reply(`⏰ Espera ${remaining}s antes de sanarte de nuevo`);
      return;
    }

    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const stats = user.stats || {
        hp: 100,
        maxHp: 100,
      };

      const currentHp = stats.hp || 100;
      const maxHp = stats.maxHp || 100;

      if (currentHp >= maxHp) {
        await ctx.reply('❤️ Ya tienes la vida completa');
        return;
      }

      const healAmount = Math.floor(maxHp * 0.5);
      const newHp = Math.min(currentHp + healAmount, maxHp);

      await serviceManager.userService.updateUser(ctx.sender.jid, {
        stats: { ...stats, hp: newHp },
      });

      healCooldowns.set(ctx.sender.jid, now);

      await ctx.reply(
        `❤️ *¡SANADO!*\n\n` +
          `❤️ HP: ${currentHp} → ${newHp}/${maxHp}\n` +
          `+${healAmount} HP recuperado\n\n` +
          `⏰ Cooldown: 60s`,
      );

      await ctx.react('❤️');
    } catch {
      await ctx.reply('❌ Error al sanar');
    }
  }
}
