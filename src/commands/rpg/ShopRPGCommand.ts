/**
 * ShopRPGCommand.ts
 *
 * rpg command `shoprpg` — Tienda de items RPG
 * Usage: !shoprpg [tipo]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { itemRegistry, type ItemType } from '@/services/rpg/ItemRegistry.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!shoprpg`: Tienda de items RPG. */
export class ShopRPGCommand extends Command {
  name = 'shoprpg';
  description = 'Tienda de items RPG';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['tiendarpg', 'rpgshop'];
  usage = '!shoprpg [tipo]';
  examples = ['!shoprpg', '!shoprpg weapons', '!shoprpg consumables'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    const filter = args[0]?.toLowerCase();

    if (!filter) {
      await this.showAllItems(ctx);
      return;
    }

    switch (filter) {
      case 'weapons':
      case 'armas':
        await this.showItems(ctx, 'weapon');
        break;
      case 'armor':
      case 'armaduras':
        await this.showItems(ctx, 'armor');
        break;
      case 'consumables':
      case 'pociones':
        await this.showItems(ctx, 'consumable');
        break;
      case 'materials':
      case 'materiales':
        await this.showItems(ctx, 'material');
        break;
      case 'pets':
      case 'mascotas':
        await this.showItems(ctx, 'pet');
        break;
      default:
        await this.showAllItems(ctx);
    }
  }

  private async showAllItems(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🏪 *TIENDA RPG*\n\n`;
    message += `💰 Tu dinero: $${user.money.toLocaleString()}\n\n`;

    const types: { key: ItemType; label: string; emoji: string }[] = [
      { key: 'weapon', label: 'Armas', emoji: '⚔️' },
      { key: 'armor', label: 'Armaduras', emoji: '🛡️' },
      { key: 'consumable', label: 'Consumibles', emoji: '🧪' },
      { key: 'material', label: 'Materiales', emoji: '🪨' },
      { key: 'pet', label: 'Mascotas', emoji: '🐾' },
    ];

    for (const type of types) {
      const items = itemRegistry.getItemsByType(type.key);
      const available = items.filter(i => i.levelRequired <= (user.level || 1));
      message += `${type.emoji} *${type.label}:* ${available.length} items\n`;
    }

    message += `\n💡 *!shoprpg [tipo]* para ver items específicos\n`;
    message += `💡 *!buy [item]* para comprar`;

    await ctx.reply(message);
  }

  private async showItems(ctx: MessageContext, type: ItemType): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);
    const items = itemRegistry.getItemsByType(type);
    const available = items.filter(i => i.levelRequired <= (user.level || 1));

    const typeLabels: Record<string, string> = {
      weapon: 'ARMAS',
      armor: 'ARMADURAS',
      consumable: 'CONSUMIBLES',
      material: 'MATERIALES',
      pet: 'MASCOTAS',
    };

    const typeEmojis: Record<string, string> = {
      weapon: '⚔️',
      armor: '🛡️',
      consumable: '🧪',
      material: '🪨',
      pet: '🐾',
    };

    let message = `${typeEmojis[type]} *TIENDA - ${typeLabels[type]}*\n\n`;
    message += `💰 Tu dinero: $${user.money.toLocaleString()}\n\n`;

    if (available.length === 0) {
      message += 'No hay items disponibles en esta categoría para tu nivel.';
    } else {
      available.forEach((item, index) => {
        const rarityEmojis: Record<string, string> = {
          common: '⬜',
          uncommon: '🟢',
          rare: '🔵',
          epic: '🟣',
          legendary: '🟡',
          mythic: '🔴',
        };

        message += `${index + 1}. ${rarityEmojis[item.rarity]} *${item.name}*\n`;
        message += `   💰 $${item.value.toLocaleString()} | 📊 `;

        const stats = [];
        if (item.stats.atk) stats.push(`ATK: +${item.stats.atk}`);
        if (item.stats.def) stats.push(`DEF: +${item.stats.def}`);
        if (item.stats.hp) stats.push(`HP: +${item.stats.hp}`);
        if (item.stats.str) stats.push(`STR: +${item.stats.str}`);
        if (item.stats.int) stats.push(`INT: +${item.stats.int}`);
        if (item.stats.agi) stats.push(`AGI: +${item.stats.agi}`);
        if (item.stats.luck) stats.push(`SUERTE: +${item.stats.luck}`);

        message += stats.join(', ') || 'Sin stats';
        message += '\n';

        if (item.levelRequired > 1) {
          message += `   🔓 Requiere nivel ${item.levelRequired}\n`;
        }
        message += '\n';
      });
    }

    message += `💡 *!buy [nombre]* para comprar`;

    await ctx.reply(message);
  }
}
