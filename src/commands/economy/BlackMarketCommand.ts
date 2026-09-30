import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { blackMarketService } from '@/services/economy/BlackMarketService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

export class BlackMarketCommand extends Command {
  name = 'blackmarket';
  description = 'Mercado negro de items';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['bm', 'mercado', 'tiendaoscura'];
  usage = '!blackmarket [listar|comprar|cancelar]';
  examples = ['!blackmarket', '!blackmarket comprar id', '!blackmarket listar diamond 500'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    const action = args[0]?.toLowerCase();

    switch (action) {
      case 'listar':
      case 'list':
        await this.listItem(ctx);
        break;
      case 'comprar':
      case 'buy':
        await this.buyItem(ctx);
        break;
      case 'cancelar':
      case 'cancel':
        await this.cancelListing(ctx);
        break;
      case 'mis':
      case 'my':
        await this.myListings(ctx);
        break;
      default:
        await this.showMarket(ctx);
    }
  }

  private async showMarket(ctx: MessageContext): Promise<void> {
    const listings = blackMarketService.getListings();
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🏪 *MERCADO NEGRO*\n\n`;
    message += `💰 Tu balance: $${formatNumber(user.money)}\n`;
    message += `📦 Listings: ${listings.length}/50\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (listings.length === 0) {
      message += `✨ El mercado está vacío\n`;
      message += `💡 Usa !blackmarket listar [item] [precio] para vender`;
    } else {
      const displayListings = listings.slice(0, 10);
      displayListings.forEach((listing, i) => {
        const emoji = this.getRarityEmoji(listing.rarity);
        message += `${i + 1}. ${emoji} *${listing.itemName}*\n`;
        message += `   💰 $${formatNumber(listing.sellPrice)}\n`;
        message += `   🆔 \`${listing.id.slice(0, 8)}\`\n\n`;
      });

      if (listings.length > 10) {
        message += `📋 Y ${listings.length - 10} más...\n`;
      }
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💡 *Comandos:*\n`;
    message += `• !blackmarket listar [item] [precio]\n`;
    message += `• !blackmarket comprar [id]\n`;
    message += `• !blackmarket mis`;

    await ctx.reply(message);
  }

  private async listItem(ctx: MessageContext): Promise<void> {
    const args = ctx.args.slice(1);
    const itemId = args[0];
    const priceStr = args[1];
    const price = parseInt(priceStr);

    if (!itemId || !priceStr || isNaN(price) || price <= 0) {
      const randomItems = blackMarketService.getRandomItems();
      await ctx.reply(
        `📦 *LISTAR EN EL MERCADO NEGRO*\n\n` +
          `✿ *Cómo usar:*\n` +
          `!blackmarket listar [item] [precio]\n\n` +
          `📋 *Items que puedes vender:*\n\n` +
          randomItems
            .map(item => `• ${item.itemId} ($${item.minPrice}-$${item.maxPrice})`)
            .join('\n') +
          `\n\n💡 *Ejemplo:*\n!blackmarket listar diamond 1000`,
      );
      return;
    }

    const result = await blackMarketService.listItem(ctx.sender.jid, itemId.toLowerCase(), price);

    if (result.success) {
      await ctx.reply(result.message);
    } else {
      await ctx.reply(result.message);
    }
  }

  private async buyItem(ctx: MessageContext): Promise<void> {
    const listingId = ctx.args[1];

    if (!listingId) {
      await ctx.reply(`❌ Especifica el ID del item\n\n💡 Usa !blackmarket para ver los items`);
      return;
    }

    const listings = blackMarketService.getListings();
    const fullListing = listings.find(l => l.id.startsWith(listingId));

    if (!fullListing) {
      await ctx.reply(
        `❌ Item no encontrado\n\n💡 Usa !blackmarket para ver los items disponibles`,
      );
      return;
    }

    const result = await blackMarketService.buyItem(ctx.sender.jid, fullListing.id);

    if (result.success) {
      await ctx.reply(result.message);
      await ctx.react('💰');
    } else {
      await ctx.reply(result.message);
    }
  }

  private async cancelListing(ctx: MessageContext): Promise<void> {
    const listingId = ctx.args[1];

    if (!listingId) {
      await ctx.reply(
        `❌ Especifica el ID del listing\n\n💡 Usa !blackmarket mis para ver tus listings`,
      );
      return;
    }

    const userListings = blackMarketService.getUserListings(ctx.sender.jid);
    const fullListing = userListings.find(l => l.id.startsWith(listingId));

    if (!fullListing) {
      await ctx.reply(`❌ Listing no encontrado o no te pertenece`);
      return;
    }

    const result = await blackMarketService.cancelListing(ctx.sender.jid, fullListing.id);

    if (result.success) {
      await ctx.reply(result.message);
    } else {
      await ctx.reply(result.message);
    }
  }

  private async myListings(ctx: MessageContext): Promise<void> {
    const userListings = blackMarketService.getUserListings(ctx.sender.jid);

    let message = `📦 *TUS LISTINGS*\n\n`;

    if (userListings.length === 0) {
      message += `No tienes items en venta\n\n`;
      message += `💡 Usa !blackmarket listar [item] [precio]`;
    } else {
      userListings.forEach((listing, i) => {
        const emoji = this.getRarityEmoji(listing.rarity);
        message += `${i + 1}. ${emoji} *${listing.itemName}*\n`;
        message += `   💰 $${formatNumber(listing.sellPrice)}\n`;
        message += `   🆔 \`${listing.id.slice(0, 8)}\`\n\n`;
      });
      message += `💡 *Para cancelar:*\n!blackmarket cancelar [id]`;
    }

    await ctx.reply(message);
  }

  private getRarityEmoji(rarity: string): string {
    const map: Record<string, string> = {
      common: '⚪',
      uncommon: '🟢',
      rare: '🔵',
      epic: '🟣',
      legendary: '🟡',
    };
    return map[rarity] || '⚪';
  }
}
