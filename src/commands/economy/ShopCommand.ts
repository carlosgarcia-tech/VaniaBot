/**
 * ShopCommand.ts
 *
 * economy command `shop` — Browse the shop and buy items
 * Usage: !shop
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { shopService } from '@/services/economy/ShopService.js';

/** Command handler for `!shop`: Browse the shop and buy items. */
export class ShopCommand extends Command {
  name = 'shop';
  description = 'Browse the shop and buy items';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['store', 'tienda'];
  usage = '!shop';
  examples = ['!shop'];
  cooldown = 3000;

  async execute(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🏪 *VANIABOT SHOP*\n\n`;
    message += `💰 Your Balance: $${user.money.toLocaleString()}\n\n`;
    message += `📦 *Available Items:*\n\n`;

    shopService.getItems().forEach((item, index) => {
      const canAfford = user.money >= item.price ? '✅' : '❌';
      message += `${canAfford} *${index + 1}. ${item.emoji} ${item.name}*\n`;
      message += `   ${item.description}\n`;
      message += `   💵 Price: $${item.price.toLocaleString()}\n`;
      message += `   🏷️ Type: ${item.type}\n\n`;
    });

    message += `📝 *How to buy:*\n`;
    message += `Use: !buy <item_number>\n`;
    message += `Example: !buy 1\n\n`;
    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += footer;

    await ctx.reply(message);
  }
}
