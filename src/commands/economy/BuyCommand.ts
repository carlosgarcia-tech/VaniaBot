/**
 * BuyCommand.ts
 *
 * economy command `buy` — Buy an item from the shop
 * Usage: !buy <item_number>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { shopService } from '@/services/economy/ShopService.js';

/** Command handler for `!buy`: Buy an item from the shop. */
export class BuyCommand extends Command {
  name = 'buy';
  description = 'Buy an item from the shop';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['comprar', 'purchase'];
  usage = '!buy <item_number>';
  examples = ['!buy 1', '!buy 5'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ oops, dime qué número quieres ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *!buy* <número>\n` +
          `✿ Echa un vistazo a *!shop* para ver lo que tengo`,
      );
      return;
    }

    const itemNumber = parseInt(ctx.args[0]);
    const item = shopService.getItemByIndex(itemNumber);

    if (!item) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ oops, no encontré ese número ˚₊· ͟͟͞͞➳\n\n` +
          `✩ elige del *1* al *${shopService.getItems().length}*\n` +
          `✿ mira *!shop* para ver lo que tengo`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.money < item.price) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ oops, faltan moneditas ˚₊· ͟͟͞͞➳\n\n` +
          `${item.emoji} *${item.name}*\n` +
          `✿ vale: *$${item.price.toLocaleString()}*\n` +
          `✿ tienes: *$${user.money.toLocaleString()}*\n` +
          `✩ necesitas: *$${(item.price - user.money).toLocaleString()}* más`,
      );
      return;
    }

    await ctx.react('⏳');

    try {
      await serviceManager.userService.removeMoney(ctx.sender.jid, item.price);

      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const expiresAt = item.duration ? Date.now() + item.duration : undefined;

      const existingBuffIndex = user.activeBuffs.findIndex(b => b.buffId === item.id);
      if (existingBuffIndex >= 0) {
        user.activeBuffs[existingBuffIndex].expiresAt = expiresAt ?? 0;
      } else {
        const buffValue = this.getBuffValue(item.id);
        user.activeBuffs.push({
          buffId: item.id,
          stat: this.getBuffStat(item.id),
          value: buffValue,
          expiresAt: expiresAt ?? 0,
        });
      }
      await serviceManager.userService.updateUser(ctx.sender.jid, {
        activeBuffs: user.activeBuffs,
      });

      let message = `✅ *¡Compra Exitosa!*\n\n`;
      message += `${item.emoji} *${item.name}*\n`;
      message += `${item.description}\n\n`;
      message += `💵 Pagado: $${item.price.toLocaleString()}\n`;
      message += `💰 Nuevo saldo: $${user.money.toLocaleString()}\n\n`;

      if (item.duration) {
        const days = Math.floor(item.duration / (24 * 60 * 60 * 1000));
        const hours = Math.floor((item.duration % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        message += `⏰ Duración: ${days > 0 ? `${days}d ` : ''}${hours}h\n`;
        message += `📅 Expira: ${new Date(Date.now() + item.duration).toLocaleString()}\n\n`;
      }

      message += this.getItemEffectMessage(item.id);
      const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
      message += footer;

      await ctx.reply(message);
      await ctx.react('✅');
    } catch (error) {
      logError('[BuyCommand] Error', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error processing purchase: ${errorMessage}`);
      await ctx.react('❌');
    }
  }

  private getBuffStat(itemId: string): string {
    const buffStats: Record<string, string> = {
      vip_role: 'vip',
      legend_role: 'legend',
      daily_bonus: 'dailyBonus',
      cooldown_bypass: 'cooldown',
      xp_boost: 'xp',
      lucky_charm: 'luck',
      income_boost: 'income',
      premium_pass: 'premium',
      bank_interest: 'bankInterest',
      badge_rich: 'badgeRich',
      badge_lucky: 'badgeLucky',
      badge_pro: 'badgePro',
    };
    return buffStats[itemId] || 'unknown';
  }

  private getBuffValue(itemId: string): number {
    const buffValues: Record<string, number> = {
      vip_role: 1,
      legend_role: 1,
      daily_bonus: 10,
      cooldown_bypass: 50,
      xp_boost: 100,
      lucky_charm: 25,
      income_boost: 50,
      premium_pass: 1,
      bank_interest: 5,
      badge_rich: 1,
      badge_lucky: 1,
      badge_pro: 1,
    };
    return buffValues[itemId] || 1;
  }

  private getItemEffectMessage(itemId: string): string {
    const messages: Record<string, string> = {
      vip_role: `✨ ¡Tienes estado VIP activo!\n`,
      legend_role: `✨ ¡Tienes estado Legend activo!\n`,
      daily_bonus: `📈 ¡Bonus diario +10% activo!\n`,
      cooldown_bypass: `⚡ ¡Cooldowns reducidos 50%!\n`,
      xp_boost: `✨ ¡XP duplicado!\n`,
      lucky_charm: `🍀 ¡Suerte +25% en juegos!\n`,
      income_boost: `💰 ¡Ingresos +50% en trabajos!\n`,
      premium_pass: `💎 ¡Pasaporte VIP del casino!\n`,
      bank_interest: `🏦 ¡Interés bancario +5%!\n`,
      badge_rich: `🤑 ¡Badge de Rico obtenido!\n`,
      badge_lucky: `🍀 ¡Badge de Suerte obtenido!\n`,
      badge_pro: `🏆 ¡Badge de Pro Player obtenido!\n`,
    };
    return messages[itemId] || ``;
  }
}
