/**
 * EquipCommand.ts
 *
 * rpg command `equip` — Equipa un item de tu inventario
 * Usage: !equip [item] | !equip list
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { itemService } from '@/services/rpg/ItemService.js';

/** Command handler for `!equip`: Equipa un item de tu inventario. */
export class EquipCommand extends Command {
  name = 'equip';
  description = 'Equipa un item de tu inventario';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['equipar', 'wear'];
  usage = '!equip [item] | !equip list';
  examples = ['!equip iron_sword', '!equip leather_armor', '!equip list'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0 || args[0].toLowerCase() === 'list') {
      await this.listEquipped(ctx);
      return;
    }

    if (args[0].toLowerCase() === 'unequip' || args[0].toLowerCase() === 'desequipar') {
      await this.unequipItem(ctx, args.slice(1).join(' '));
      return;
    }

    await this.equipItem(ctx, args.join(' '));
  }

  private async equipItem(ctx: MessageContext, itemName: string): Promise<void> {
    try {
      const result = await itemService.equipItem(ctx.sender.jid, itemName);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      await ctx.reply(result.message);
      await ctx.react('⚔️');
    } catch {
      await ctx.reply('❌ Error al equipar item');
    }
  }

  private async unequipItem(ctx: MessageContext, itemName: string): Promise<void> {
    if (!itemName) {
      await ctx.reply(
        '❌ Especifica el item a desequipar\n💡 *Ejemplo:* !equip unequip iron_sword',
      );
      return;
    }

    try {
      const result = await itemService.unequipItem(ctx.sender.jid, itemName);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      await ctx.reply(result.message);
    } catch {
      await ctx.reply('❌ Error al desequipar item');
    }
  }

  private async listEquipped(ctx: MessageContext): Promise<void> {
    try {
      const equippedItems = await itemService.getEquippedItems(ctx.sender.jid);

      if (equippedItems.length === 0) {
        await ctx.reply(
          '⚔️ *EQUIPAMIENTO*\n\n' +
            'No tienes ningún item equipado.\n\n' +
            '💡 Usa !equip [item] para equipar',
        );
        return;
      }

      let message = '⚔️ *EQUIPAMIENTO*\n\n';

      const slots = {
        weapon: '🗡️ Arma',
        armor: '🛡️ Armadura',
        helmet: '⛑️ Casco',
        gloves: '🧤 Guantes',
        boots: '👢 Botas',
        accessory: '💍 Accesorio',
      };

      for (const [slot, label] of Object.entries(slots)) {
        const item = equippedItems.find(i => i.type === slot);
        if (item) {
          message += `${label}: *${item.name}*\n`;

          if (item.stats && Object.keys(item.stats).length > 0) {
            message += '   📊 ';
            message += Object.entries(item.stats)
              .map(([stat, value]) => `+${value} ${stat}`)
              .join(', ');
            message += '\n';
          }
        } else {
          message += `${label}: ❌\n`;
        }
        message += '\n';
      }

      message += '💡 Usa !equip unequip [item] para desequipar';

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar equipamiento');
    }
  }
}
