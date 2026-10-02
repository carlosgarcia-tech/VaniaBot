/**
 * SellCommand.ts
 *
 * rpg command `sell` — Vende items en el mercado
 * Usage: !sell [item] [precio] [cantidad] | !sell [item]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { tradeService } from '@/services/rpg/TradeService.js';
import { isRight } from '@/utils/either.js';

/** Command handler for `!sell`: Vende items en el mercado. */
export class SellCommand extends Command {
  name = 'sell';
  description = 'Vende items en el mercado';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['vender', 'sale'];
  usage = '!sell [item] [precio] [cantidad] | !sell [item]';
  examples = ['!sell iron_sword 500', '!sell health_potion 100 5'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length < 2) {
      await ctx.reply(
        '🏪 *VENDER EN EL MERCADO*\n\n' +
          'Usa este comando para vender items.\n\n' +
          '💡 *Ejemplos:*\n' +
          '• !sell iron_sword 500\n' +
          '• !sell health_potion 100 5\n\n' +
          '💡 *Ver mercado:* !market\n' +
          '💡 *Tus ofertas:* !market my',
      );
      return;
    }

    const itemName = args.slice(0, -2).join(' ') || args[0];
    const price = parseInt(args[args.length - 2]);
    const quantity = parseInt(args[args.length - 1]) || 1;

    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ El precio debe ser un número mayor a 0');
      return;
    }

    try {
      const result = await tradeService.createOffer(ctx.sender.jid, itemName, price, quantity);

      if (!isRight(result)) {
        await ctx.reply(result.left.message);
        return;
      }

      await ctx.reply(result.right.message);
      await ctx.react('💰');
    } catch {
      await ctx.reply('❌ Error al crear oferta');
    }
  }
}
