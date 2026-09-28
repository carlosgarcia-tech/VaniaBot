import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { tradeService } from '@/services/rpg/TradeService.js';

export class MarketCommand extends Command {
  name = 'market';
  description = 'Ver el mercado de items';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['rpgmarket', 'markets'];
  usage = '!market [pagina] | !market my';
  examples = ['!market', '!market 2', '!market my'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length > 0 && args[0].toLowerCase() === 'my') {
      await this.myOffers(ctx);
      return;
    }

    const page = parseInt(args[0]) || 1;
    await this.listMarket(ctx, page);
  }

  private async listMarket(ctx: MessageContext, page: number): Promise<void> {
    try {
      const message = tradeService.formatMarket(page);
      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al mostrar el mercado');
    }
  }

  private async myOffers(ctx: MessageContext): Promise<void> {
    try {
      const message = tradeService.formatMyOffers(ctx.sender.jid);
      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al mostrar tus ofertas');
    }
  }
}
