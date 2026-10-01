import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const searchCooldowns = new Map<string, number>();
const SEARCH_COOLDOWN = 60 * 1000;

export class SearchCommand extends Command {
  // Sin name 'search' (chocaba con la busqueda web de BuscarCommand):
  // el juego se ejecuta ahora como !encontrar.
  name = 'encontrar';
  description = 'Encontrar dinero en la calle';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['encontrar', 'encontrar dinero'];
  usage = '!search';
  cooldown = 60000;

  private readonly FINDS = [
    { text: 'encontraste unas monedas', min: 5, max: 20, emoji: '🪙', chance: 0.3 },
    { text: 'encontraste una billetera', min: 50, max: 200, emoji: '👛', chance: 0.2 },
    { text: 'encontraste dinero en la calle', min: 100, max: 500, emoji: '💵', chance: 0.15 },
    { text: 'encontraste una tarjeta', min: 0, max: 0, emoji: '💳', chance: 0.1 },
    { text: 'nada... sigue buscando', min: 0, max: 0, emoji: '🔍', chance: 0.15 },
    { text: 'encontraste oro!', min: 500, max: 1500, emoji: '🥇', chance: 0.05 },
    { text: 'encontraste un diamante!', min: 2000, max: 5000, emoji: '💎', chance: 0.03 },
    { text: 'encontraste un tesoro!', min: 5000, max: 15000, emoji: '💰', chance: 0.02 },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastSearch = searchCooldowns.get(ctx.sender.jid);

    if (lastSearch && now - lastSearch < SEARCH_COOLDOWN) {
      const remaining = Math.ceil((SEARCH_COOLDOWN - (now - lastSearch)) / 1000);
      await ctx.reply(
        `🔍 *YA BUSCASTE*\n\n` + `Espera *${remaining} segundos*\n` + `para buscar de nuevo.`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      const reward = Math.floor(Math.random() * 5000) + 2000;
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      await ctx.reply(
        `🔍 *BUSCAR* 🔍\n\n` +
          `👑 *Dueño:* Encontraste un maletín con dinero!\n` +
          `💰 +$${reward.toLocaleString()}`,
      );
      await ctx.react('👑');
      return;
    }

    const rand = Math.random();
    let cumulative = 0;
    let found = this.FINDS[this.FINDS.length - 1];

    for (const f of this.FINDS) {
      cumulative += f.chance;
      if (rand <= cumulative) {
        found = f;
        break;
      }
    }

    let earned = 0;
    if (found.min > 0) {
      earned = Math.floor(Math.random() * (found.max - found.min + 1)) + found.min;
      await serviceManager.userService.addMoney(ctx.sender.jid, earned);
    }

    searchCooldowns.set(ctx.sender.jid, now);

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    await ctx.reply(
      `🔍 *BUSCAR* 🔍\n\n` +
        `Tú: ${found.emoji}\n\n` +
        `${found.text}\n\n` +
        (earned > 0
          ? `💰 *+$${earned.toLocaleString()}*\n\n💵 Balance: $${updatedUser.money.toLocaleString()}`
          : `💔 *Mejor suerte la próxima vez*`) +
        `\n\n⏰ Intenta de nuevo en 1 minuto`,
    );

    await ctx.react(earned > 0 ? found.emoji : '😢');
  }
}
