import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { itemService } from '@/services/rpg/ItemService.js';

export class StatsCommand extends Command {
  name = 'stats';
  description = 'Muestra tus estadísticas RPG';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['rpgstats', 'rpgchar', 'char'];
  usage = '!stats [@usuario]';
  examples = ['!stats', '!stats @usuario'];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const mentionedJid = ctx.mentionedJid;
      const targetJid = mentionedJid || ctx.sender.jid;

      const user = await serviceManager.userService.getUser(targetJid);
      const totalStats = await itemService.getTotalStats(targetJid);

      const stats = user.stats || {
        hp: 100,
        maxHp: 100,
        energy: 100,
        maxEnergy: 100,
        stamina: 100,
        maxStamina: 100,
        atk: 10,
        def: 5,
        str: 10,
        int: 10,
        agi: 10,
        vit: 10,
        luck: 5,
        critChance: 5,
        dodgeChance: 5,
      };

      const equippedItems = await itemService.getEquippedItems(targetJid);

      const message = `
⚔️ *PERSONAJE - ${user.name}*
━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ *Salud:* ${stats.hp || 100}/${stats.maxHp || 100}
⚡ *Energía:* ${stats.energy || 100}/${stats.maxEnergy || 100}
💪 *Resistencia:* ${stats.stamina || 100}/${stats.maxStamina || 100}

⚔️ *Combate*
━━━━━━━━━━━━━━━━
🗡️ Ataque: ${totalStats.atk || stats.atk || 10}
🛡️ Defensa: ${totalStats.def || stats.def || 5}

📊 *Atributos*
━━━━━━━━━━━━━━━━
💪 STR: ${totalStats.str || stats.str || 10}
🧠 INT: ${totalStats.int || stats.int || 10}
🏃 AGI: ${totalStats.agi || stats.agi || 10}
❤️ VIT: ${totalStats.vit || stats.vit || 10}
🍀 SUERTE: ${totalStats.luck || stats.luck || 5}

🎯 *Probabilidades*
━━━━━━━━━━━━━━━━
⚔️ Crit: ${totalStats.critChance || stats.critChance || 5}%
💨 Evasión: ${totalStats.dodgeChance || stats.dodgeChance || 5}%

🎒 *Equipamiento*
━━━━━━━━━━━━━━━━
${
  equippedItems.length > 0
    ? equippedItems.map(item => `• ${item.name}`).join('\n')
    : 'Sin equipo equipado'
}

📦 *Clase:* ${user.currentClass ? user.currentClass : 'Sin clase'}
📈 *Nivel:* ${user.level || 1}
`.trim();

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener estadísticas');
    }
  }
}
