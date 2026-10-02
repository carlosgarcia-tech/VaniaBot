/**
 * FightCommand.ts
 *
 * rpg command `fight` — Lucha contra un mobs
 * Usage: !fight [mob] | !fight flee
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { combatService } from '@/services/rpg/CombatService.js';
import { mobService } from '@/services/rpg/MobService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const fightCooldowns = new Map<string, number>();
const FIGHT_COOLDOWN = 5000;

/** Command handler for `!fight`: Lucha contra un mobs. */
export class FightCommand extends Command {
  name = 'fight';
  description = 'Lucha contra un mobs';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['batallar', 'combat', 'atacar'];
  usage = '!fight [mob] | !fight flee';
  examples = ['!fight slime', '!fight wolf', '!fight flee'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length > 0 && args[0].toLowerCase() === 'list') {
      await this.listMobs(ctx);
      return;
    }

    if (args.length > 0 && args[0].toLowerCase() === 'zones') {
      await this.listZones(ctx);
      return;
    }

    if (
      (args.length > 0 && args[0].toLowerCase() === 'flee') ||
      (args.length > 0 && args[0].toLowerCase() === 'escapar')
    ) {
      await this.flee(ctx);
      return;
    }

    if (args.length > 0 && args[0].toLowerCase() === 'status') {
      await this.combatStatus(ctx);
      return;
    }

    const now = Date.now();
    const lastFight = fightCooldowns.get(ctx.sender.jid);

    if (lastFight && now - lastFight < FIGHT_COOLDOWN) {
      const remaining = Math.ceil((FIGHT_COOLDOWN - (now - lastFight)) / 1000);
      await ctx.reply(`⏰ Espera ${remaining}s antes de luchar de nuevo`);
      return;
    }

    if (args.length === 0) {
      await this.randomFight(ctx);
      return;
    }

    const mobName = args.join(' ');
    await this.startFight(ctx, mobName);
  }

  private async startFight(ctx: MessageContext, mobName: string): Promise<void> {
    try {
      const result = await combatService.startCombat(ctx.sender.jid, mobName);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      fightCooldowns.set(ctx.sender.jid, Date.now());
      await ctx.reply(result.message);
      await ctx.react(result.message.includes('VICTORIA') ? '🏆' : '💀');
    } catch {
      await ctx.reply('❌ Error al iniciar combate');
    }
  }

  private async randomFight(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const mob = mobService.getRandomMob(user.level || 1);

      const result = await combatService.startCombat(ctx.sender.jid, mob.id);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      fightCooldowns.set(ctx.sender.jid, Date.now());
      await ctx.reply(result.message);
      await ctx.react(result.message.includes('VICTORIA') ? '🏆' : '💀');
    } catch {
      await ctx.reply('❌ Error al iniciar combate aleatorio');
    }
  }

  private async flee(ctx: MessageContext): Promise<void> {
    try {
      const result = await combatService.flee(ctx.sender.jid);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      fightCooldowns.set(ctx.sender.jid, Date.now());
      await ctx.reply(result.message);
    } catch {
      await ctx.reply('❌ Error al intentar escapar');
    }
  }

  private async combatStatus(ctx: MessageContext): Promise<void> {
    try {
      const status = combatService.getCombatStatus(ctx.sender.jid);

      if (!status.active) {
        await ctx.reply('❌ No tienes un combate activo');
        return;
      }

      const message = `
⚔️ *COMBATE ACTIVO*
━━━━━━━━━━━━━━━━━━
${status.mob?.emoji} *${status.mob?.name}*
❤️ HP: ${status.mob?.hp}/${status.mob?.maxHp}
🗡️ Ataque: ${status.mob?.atk}
🛡️ Defensa: ${status.mob?.def}

👤 *Tu HP:* ${status.playerHp}
📊 Turno: ${status.turns}

💡 *Acciones:*
• !fight (atacar)
• !fight flee (escapar)
      `.trim();

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener estado del combate');
    }
  }

  private async listMobs(ctx: MessageContext): Promise<void> {
    const message = mobService.formatMobList();
    await ctx.reply(message);
  }

  private async listZones(ctx: MessageContext): Promise<void> {
    const zones = mobService.getZones();

    let message = '🗺️ *ZONAS DE CAZA*\n\n';

    const zoneEmojis: Record<string, string> = {
      bosque: '🌲',
      cuevas: '🕳️',
      montañas: '⛰️',
      volcán: '🌋',
      castillo: '🏰',
      boss: '👹',
    };

    for (const zone of zones) {
      const emoji = zoneEmojis[zone] || '📍';
      message += `${emoji} *${zone.charAt(0).toUpperCase() + zone.slice(1)}*\n`;
    }

    message += '\n💡 Usa !fight [mob] para atacar un enemigo';

    await ctx.reply(message);
  }
}
