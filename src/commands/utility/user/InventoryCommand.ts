/**
 * InventoryCommand.ts
 *
 * utility command `inventory` — Muestra tu inventario de items
 * Usage: !inventory [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!inventory`: Muestra tu inventario de items. */
export class InventoryCommand extends Command {
  name = 'inventory';
  description = 'Muestra tu inventario de items';
  category = CommandCategory.UTILITY;
  requiresRegistration = true;
  aliases = ['inv', 'inventario', 'mochila', 'bag'];
  usage = '!inventory [@usuario]';
  examples = ['!inventory', '!inv', '!inventory @5215551234567'];

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;
    const targetJid = mentionedJid || ctx.sender.jid;
    const isSelf = targetJid === ctx.sender.jid;

    try {
      const user = await serviceManager.userService.getUser(targetJid);

      const inventory = user.inventory || [];

      if (inventory.length === 0) {
        await ctx.reply(
          isSelf
            ? '🎒 Tu inventario está vacío\n\n💡 Usa comandos como !daily, !work para conseguir items'
            : `🎒 ${user.name} no tiene items en su inventario`,
        );
        return;
      }

      const itemCounts = new Map<string, { count: number; name: string }>();
      inventory.forEach(item => {
        const existing = itemCounts.get(item.itemId);
        if (existing) {
          existing.count++;
        } else {
          itemCounts.set(item.itemId, { count: 1, name: item.name });
        }
      });

      let itemsList = '';
      let index = 1;

      for (const [itemId, { count, name }] of itemCounts) {
        const emoji = this.getItemEmoji(itemId);
        const displayName = this.getItemDisplayName(itemId) || name;
        itemsList += `┃ ${index}. ${emoji} ${displayName}`;

        if (count > 1) {
          itemsList += ` x${count}`;
        }

        itemsList += '\n';
        index++;
      }

      const message = `
┏━━━━━━━━━━━━━━━
┃ 🎒 *INVENTARIO*
┣━━━━━━━━━━━━━━━
┃
┃ ${user.name}
┃
${itemsList}┃
┃ Total: ${inventory.length}
┃ Únicos: ${itemCounts.size}
┗━━━━━━━━━━━━━━━
${isSelf ? '\n💡 !use [item] para usar' : ''}
      `.trim();

      await ctx.reply(message);
    } catch (error) {
      logError('[InventoryCommand] Error', error);
      await ctx.reply('❌ Error al obtener el inventario');
    }
  }

  private getItemEmoji(item: string): string {
    const emojiMap: Record<string, string> = {
      apple: '🍎',
      bread: '🍞',
      fish: '🐟',
      meat: '🥩',
      cookie: '🍪',

      pickaxe: '⛏️',
      axe: '🪓',
      sword: '⚔️',
      shield: '🛡️',
      bow: '🏹',

      wood: '🪵',
      stone: '🪨',
      iron: '⚙️',
      gold: '🪙',
      diamond: '💎',

      health_potion: '❤️',
      mana_potion: '💙',
      speed_potion: '⚡',

      key: '🔑',
      map: '🗺️',
      compass: '🧭',
      book: '📖',
      scroll: '📜',
    };

    return emojiMap[item.toLowerCase()] || '📦';
  }

  private getItemDisplayName(item: string): string {
    const nameMap: Record<string, string> = {
      apple: 'Manzana',
      bread: 'Pan',
      fish: 'Pescado',
      meat: 'Carne',
      cookie: 'Galleta',

      pickaxe: 'Pico',
      axe: 'Hacha',
      sword: 'Espada',
      shield: 'Escudo',
      bow: 'Arco',

      wood: 'Madera',
      stone: 'Piedra',
      iron: 'Hierro',
      gold: 'Oro',
      diamond: 'Diamante',

      health_potion: 'Poción de Vida',
      mana_potion: 'Poción de Maná',
      speed_potion: 'Poción de Velocidad',

      key: 'Llave',
      map: 'Mapa',
      compass: 'Brújula',
      book: 'Libro',
      scroll: 'Pergamino',
    };

    return nameMap[item.toLowerCase()] || item.charAt(0).toUpperCase() + item.slice(1);
  }
}
