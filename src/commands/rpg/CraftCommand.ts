/**
 * CraftCommand.ts
 *
 * rpg command `craft` — Craftea items usando materiales
 * Usage: !craft [item] | !craft list | !craft [item]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { craftService } from '@/services/rpg/CraftService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!craft`: Craftea items usando materiales. */
export class CraftCommand extends Command {
  name = 'craft';
  description = 'Craftea items usando materiales';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['craftear', 'make', 'receta'];
  usage = '!craft [item] | !craft list | !craft [item]';
  examples = ['!craft iron_sword', '!craft list', '!craft health_potion'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0 || args[0].toLowerCase() === 'list') {
      await this.listRecipes(ctx);
      return;
    }

    if (args[0].toLowerCase() === 'info') {
      await this.recipeInfo(ctx, args.slice(1).join(' '));
      return;
    }

    await this.craftItem(ctx, args.join(' '));
  }

  private async listRecipes(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const message = craftService.formatRecipeList(user.level || 1);
      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar recetas');
    }
  }

  private async recipeInfo(ctx: MessageContext, itemName: string): Promise<void> {
    if (!itemName) {
      await ctx.reply('❌ Especifica el item\n💡 *Ejemplo:* !craft info iron_sword');
      return;
    }

    try {
      const recipe = craftService.getRecipeByName(itemName);

      if (!recipe) {
        await ctx.reply('❌ Receta no encontrada');
        return;
      }

      const message = craftService.formatRecipeDetails(recipe);
      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener detalles de la receta');
    }
  }

  private async craftItem(ctx: MessageContext, itemName: string): Promise<void> {
    try {
      const result = await craftService.craftItem(ctx.sender.jid, itemName);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      await ctx.reply(result.message);
      await ctx.react('🔨');
    } catch {
      await ctx.reply('❌ Error al craftear');
    }
  }
}
