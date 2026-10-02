/**
 * ClassCommand.ts
 *
 * rpg command `class` — Selecciona o ve las clases disponibles
 * Usage: !class [nombre] | !class list
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { classService } from '@/services/rpg/ClassService.js';

/** Command handler for `!class`: Selecciona o ve las clases disponibles. */
export class ClassCommand extends Command {
  name = 'class';
  description = 'Selecciona o ve las clases disponibles';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['clase', 'clases'];
  usage = '!class [nombre] | !class list';
  examples = ['!class warrior', '!class list', '!clases'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0 || args[0].toLowerCase() === 'list') {
      await this.listClasses(ctx);
      return;
    }

    if (args[0].toLowerCase() === 'info' && args[1]) {
      await this.classInfo(ctx, args[1]);
      return;
    }

    await this.selectClass(ctx, args[0]);
  }

  private async listClasses(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const availableClasses = classService.getAvailableClasses(user.level || 1);

      let message = `⚔️ *CLASES DISPONIBLES*\n\n`;
      message += `Tu nivel: ${user.level || 1}\n\n`;

      for (const cls of availableClasses) {
        const isSelected = user.currentClass === cls.id;
        message += `${isSelected ? '✅' : '⬜'} *${cls.emoji} ${cls.name}*\n`;
        message += `   📝 ${cls.description}\n`;
        message += `   📊 Stats: `;
        const stats = [];
        if (cls.statsBonus.hp) stats.push(`+${cls.statsBonus.hp} HP`);
        if (cls.statsBonus.atk) stats.push(`+${cls.statsBonus.atk} ATK`);
        if (cls.statsBonus.def) stats.push(`+${cls.statsBonus.def} DEF`);
        if (cls.statsBonus.str) stats.push(`+${cls.statsBonus.str} STR`);
        if (cls.statsBonus.int) stats.push(`+${cls.statsBonus.int} INT`);
        if (cls.statsBonus.agi) stats.push(`+${cls.statsBonus.agi} AGI`);
        if (cls.statsBonus.vit) stats.push(`+${cls.statsBonus.vit} VIT`);
        if (cls.statsBonus.luck) stats.push(`+${cls.statsBonus.luck} SUERTE`);
        message += stats.join(', ') + '\n';

        if (cls.requiredLevel > 1) {
          message += `   🔓 Requiere nivel ${cls.requiredLevel}\n`;
        }
        message += '\n';
      }

      message += `\n💡 *!class [nombre]* para seleccionar una clase`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar clases');
    }
  }

  private async classInfo(ctx: MessageContext, className: string): Promise<void> {
    try {
      const cls = classService.getClassByName(className);
      if (!cls) {
        await ctx.reply('❌ Clase no encontrada');
        return;
      }

      let message = `⚔️ *${cls.name.toUpperCase()}*\n\n`;
      message += `${cls.emoji} ${cls.description}\n\n`;

      message += `📊 *Bonificaciones de stats:*\n`;
      const stats = [];
      if (cls.statsBonus.hp) stats.push(`+${cls.statsBonus.hp} HP`);
      if (cls.statsBonus.atk) stats.push(`+${cls.statsBonus.atk} Ataque`);
      if (cls.statsBonus.def) stats.push(`+${cls.statsBonus.def} Defensa`);
      if (cls.statsBonus.str) stats.push(`+${cls.statsBonus.str} Fuerza`);
      if (cls.statsBonus.int) stats.push(`+${cls.statsBonus.int} Inteligencia`);
      if (cls.statsBonus.agi) stats.push(`+${cls.statsBonus.agi} Agilidad`);
      if (cls.statsBonus.vit) stats.push(`+${cls.statsBonus.vit} Vitalidad`);
      if (cls.statsBonus.luck) stats.push(`+${cls.statsBonus.luck} Suerte`);
      message += stats.join('\n') + '\n\n';

      message += `🛡️ *Skills:*\n`;
      message += cls.skills.join(', ') + '\n\n';

      message += `🔓 Nivel requerido: ${cls.requiredLevel}`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener información de la clase');
    }
  }

  private async selectClass(ctx: MessageContext, className: string): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const cls = classService.getClassByName(className);

      if (!cls) {
        await ctx.reply(
          `❌ Clase "${className}" no encontrada\n\n💡 Usa !class list para ver las clases disponibles`,
        );
        return;
      }

      if (user.level < cls.requiredLevel) {
        await ctx.reply(
          `❌ Necesitas nivel ${cls.requiredLevel} para seleccionar esta clase\n💡 Tu nivel actual: ${user.level || 1}`,
        );
        return;
      }

      if (user.currentClass === cls.id) {
        await ctx.reply(`ℹ️ Ya eres ${cls.name}`);
        return;
      }

      await serviceManager.userService.updateUser(ctx.sender.jid, {
        currentClass: cls.id,
      });

      await ctx.reply(
        `
✅ *¡Clase seleccionada!*

${cls.emoji} *${cls.name}*
📝 ${cls.description}

📊 *Stats obtenidos:*
${Object.entries(cls.statsBonus)
  .map(([key, value]) => {
    if (value && value > 0) {
      const statNames: Record<string, string> = {
        hp: 'HP',
        atk: 'Ataque',
        def: 'Defensa',
        str: 'Fuerza',
        int: 'Inteligencia',
        agi: 'Agilidad',
        vit: 'Vitalidad',
        luck: 'Suerte',
      };
      return `+${value} ${statNames[key] || key}`;
    }
    return null;
  })
  .filter(Boolean)
  .join('\n')}
      `.trim(),
      );
    } catch {
      await ctx.reply('❌ Error al seleccionar clase');
    }
  }
}
