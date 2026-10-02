/**
 * BuyRPGCommand.ts
 *
 * rpg command `buyrpg` — Compra items de la tienda RPG
 * Usage: !buyrpg [item] [cantidad]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { itemRegistry, type RPGItem } from '@/services/rpg/ItemRegistry.js';
import { itemService } from '@/services/rpg/ItemService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!buyrpg`: Compra items de la tienda RPG. */
export class BuyRPGCommand extends Command {
  name = 'buyrpg';
  description = 'Compra items de la tienda RPG';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['comprarrpg', 'buyitemrpg'];
  usage = '!buyrpg [item] [cantidad]';
  examples = ['!buyrpg iron_sword', '!buyrpg health_potion 5'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0) {
      await ctx.reply(
        '💰 *COMPRAR DE LA TIENDA RPG*\n\n' +
          'Usa !shoprpg para ver los items disponibles.\n\n' +
          '💡 *Ejemplos:*\n' +
          '• !buyrpg iron_sword\n' +
          '• !buyrpg health_potion 5\n\n' +
          '💡 *Ver tienda:* !shoprpg',
      );
      return;
    }

    const quantity = parseInt(args[args.length - 1]) || 1;
    const itemName =
      args.length > 1 && !isNaN(parseInt(args[args.length - 1]))
        ? args.slice(0, -1).join(' ')
        : args.join(' ');

    try {
      const item = this.findItem(itemName);

      if (!item) {
        await ctx.reply(`❌ Item "${itemName}" no encontrado\n💡 Usa !shoprpg para ver los items`);
        return;
      }

      const user = await serviceManager.userService.getUser(ctx.sender.jid);

      if (user.level < item.levelRequired) {
        await ctx.reply(`❌ Necesitas nivel ${item.levelRequired} para comprar ${item.name}`);
        return;
      }

      const totalPrice = item.value * quantity;

      if (user.money < totalPrice) {
        await ctx.reply(
          `❌ No tienes suficiente dinero.\n💰 Precio: $${totalPrice}\n💵 Tu dinero: $${user.money}`,
        );
        return;
      }

      const removed = await serviceManager.userService.removeMoney(ctx.sender.jid, totalPrice);
      if (!removed) {
        await ctx.reply('❌ Error al procesar el pago');
        return;
      }

      for (let i = 0; i < quantity; i++) {
        await itemService.addItem(ctx.sender.jid, item.id);
      }

      await ctx.reply(
        `✅ *¡Compra exitosa!*\n\n` +
          `📦 Item: ${item.name}\n` +
          `📦 Cantidad: ${quantity}\n` +
          `💰 Total: $${totalPrice.toLocaleString()}\n\n` +
          `💡 *!inventory* para ver tu inventario`,
      );

      await ctx.react('💰');
    } catch {
      await ctx.reply('❌ Error al comprar item');
    }
  }

  private findItem(name: string): RPGItem | undefined {
    const items = itemRegistry.getAllItems();
    return items.find(
      item =>
        item.name.toLowerCase().includes(name.toLowerCase()) ||
        item.id.toLowerCase().includes(name.toLowerCase()),
    );
  }
}
