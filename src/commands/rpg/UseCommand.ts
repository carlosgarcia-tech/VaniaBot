import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { itemService } from '@/services/rpg/ItemService.js';

export class UseCommand extends Command {
  name = 'use';
  description = 'Usa un item consumible de tu inventario';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['usar', 'beber', 'consumir'];
  usage = '!use [item]';
  examples = ['!use health_potion', '!use apple', '!usar pocion'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0) {
      await ctx.reply(
        '🎒 *USAR ITEM*\n\n' +
          'Usa este comando para consumir items como pociones.\n\n' +
          '💡 *Ejemplo:* !use health_potion\n\n' +
          '💡 *Ver inventario:* !inventory',
      );
      return;
    }

    const itemName = args.join(' ');

    try {
      const result = await itemService.useItem(ctx.sender.jid, itemName);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      await ctx.reply(result.message);
      await ctx.react('✅');
    } catch {
      await ctx.reply('❌ Error al usar el item');
    }
  }
}
