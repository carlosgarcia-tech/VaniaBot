/**
 * RPGCommand.ts
 *
 * rpg command `rpg` — Panel principal del sistema RPG
 * Usage: !rpg
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { itemService } from '@/services/rpg/ItemService.js';
import { classService } from '@/services/rpg/ClassService.js';

/** Command handler for `!rpg`: Panel principal del sistema RPG. */
export class RPGCommand extends Command {
  name = 'rpg';
  description = 'Panel principal del sistema RPG';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['rpgpanel', 'panelrpg'];
  usage = '!rpg';

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const stats = user.stats || {
        hp: 100,
        maxHp: 100,
        atk: 10,
        def: 5,
      };
      const totalStats = await itemService.getTotalStats(ctx.sender.jid);
      const equippedItems = await itemService.getEquippedItems(ctx.sender.jid);
      const userClass = user.currentClass ? classService.getClass(user.currentClass) : null;

      const message = `
⚔️ *VANIABOT RPG*
━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *${user.name}*
📊 Nivel: ${user.level || 1} | Clase: ${userClass?.name || 'Sin clase'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ *HP:* ${stats.hp}/${stats.maxHp}
⚔️ *Ataque:* ${totalStats.atk || stats.atk}
🛡️ *Defensa:* ${totalStats.def || stats.def}

🎒 *Inventario:* ${user.inventory?.length || 0} items
⚔️ *Equipados:* ${equippedItems.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *COMANDOS RPG*
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚔️ *Combate*
━━━━━━━━━━━━━━━━
!fight [mob] - Pelear contra un enemigo
!fight - Pelea aleatoria
!mobs - Ver bestiario
!zonas - Ver zonas de caza

🎒 *Inventario*
━━━━━━━━━━━━━━━━
!inventory (!inv) - Ver inventario
!use [item] - Usar item
!equip [item] - Equipar item

📦 *Tienda*
━━━━━━━━━━━━━━━━
!shop - Tienda del juego
!buy [item] - Comprar item
!sell [item] [precio] - Vender
!market - Ver mercado

⚒️ *Crafting*
━━━━━━━━━━━━━━━━
!craft [item] - Craftear
!recipes - Ver recetas
!materials - Ver materiales

🐾 *Mascotas*
━━━━━━━━━━━━━━━━
!pet - Ver mascotas
!pet adopt [nombre] - Adoptar
!pet shop - Tienda de pets

📜 *Misiones*
━━━━━━━━━━━━━━━━
!quest - Ver quests
!quest daily - Diarias
!quest main - Principales

🏰 *Clases*
━━━━━━━━━━━━━━━━
!class - Ver clases
!class [nombre] - Seleccionar

📊 *Otros*
━━━━━━━━━━━━━━━━
!stats - Ver estadísticas
!heal - Sanarse
      `.trim();

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al mostrar el panel RPG');
    }
  }
}
