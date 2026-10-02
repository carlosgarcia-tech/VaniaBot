/**
 * PetCommand.ts
 *
 * rpg command `pet` — Gestiona tus mascotas
 * Usage: !pet [list/adopt/release/feed] [nombre]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { petService } from '@/services/rpg/PetService.js';
import { isRight } from '@/utils/either.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { itemRegistry } from '@/services/rpg/ItemRegistry.js';

/** Command handler for `!pet`: Gestiona tus mascotas. */
export class PetCommand extends Command {
  name = 'pet';
  description = 'Gestiona tus mascotas';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['mascota', 'mascotas', 'pets'];
  usage = '!pet [list/adopt/release/feed] [nombre]';
  examples = ['!pet list', '!pet adopt cat', '!pet feed wolf', '!pet release dog'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0 || args[0].toLowerCase() === 'list') {
      await this.listMyPets(ctx);
      return;
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'adopt':
      case 'adoptar':
        await this.adoptPet(ctx, args.slice(1).join(' '));
        break;
      case 'release':
      case 'liberar':
        await this.releasePet(ctx, args.slice(1).join(' '));
        break;
      case 'feed':
      case 'alimentar':
        await this.feedPet(ctx, args.slice(1).join(' '));
        break;
      case 'shop':
      case 'tienda':
        await this.petShop(ctx);
        break;
      default:
        await this.listMyPets(ctx);
    }
  }

  private async listMyPets(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const message = petService.formatPetList(user);
      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar mascotas');
    }
  }

  private async adoptPet(ctx: MessageContext, petName: string): Promise<void> {
    if (!petName) {
      await ctx.reply('❌ Especifica la mascota\n💡 *Ejemplo:* !pet adopt cat');
      return;
    }

    try {
      const petData = petService.getPetDataByName(petName);

      if (!petData) {
        await ctx.reply('❌ Mascota no encontrada\n💡 Usa !pet shop para ver las disponibles');
        return;
      }

      const result = await petService.adoptPet(ctx.sender.jid, petData.id);

      if (!isRight(result)) {
        await ctx.reply(result.left.message);
        return;
      }

      await ctx.reply(result.right.message);
      await ctx.react('🐾');
    } catch {
      await ctx.reply('❌ Error al adoptar mascota');
    }
  }

  private async releasePet(ctx: MessageContext, petName: string): Promise<void> {
    if (!petName) {
      await ctx.reply('❌ Especifica la mascota a liberar\n💡 *Ejemplo:* !pet release cat');
      return;
    }

    try {
      const result = await petService.releasePet(ctx.sender.jid, petName);

      if (!isRight(result)) {
        await ctx.reply(result.left.message);
        return;
      }

      await ctx.reply(result.right.message);
    } catch {
      await ctx.reply('❌ Error al liberar mascota');
    }
  }

  private async feedPet(ctx: MessageContext, petName: string): Promise<void> {
    if (!petName) {
      await ctx.reply('❌ Especifica la mascota a alimentar\n💡 *Ejemplo:* !pet feed cat');
      return;
    }

    try {
      const result = await petService.feedPet(ctx.sender.jid, petName);

      if (!isRight(result)) {
        await ctx.reply(result.left.message);
        return;
      }

      await ctx.reply(result.right.message);
      await ctx.react('🍖');
    } catch {
      await ctx.reply('❌ Error al alimentar mascota');
    }
  }

  private async petShop(ctx: MessageContext): Promise<void> {
    try {
      const petData = petService.getAllPetData();

      let message = '🐾 *TIENDA DE MASCOTAS*\n\n';

      for (const pet of petData) {
        message += `${pet.emoji} *${pet.name}*\n`;
        message += `   📝 ${pet.description}\n`;
        message += `   💰 Precio: $${itemRegistry.getItem(pet.id)?.value || 0}\n`;

        if (pet.baseStats) {
          message += `   📊 Stats: `;
          message += Object.entries(pet.baseStats)
            .map(([stat, value]) => `+${value} ${stat}`)
            .join(', ');
          message += '\n';
        }
        message += '\n';
      }

      message += '💡 Usa !pet adopt [nombre] para adoptar';

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al mostrar tienda');
    }
  }
}
