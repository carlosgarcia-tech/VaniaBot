/**
 * HeistCommand.ts
 *
 * economy command `heist` — Asalto al banco (alto riesgo, alta recompensa)
 * Usage: !heist <cantidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

const heistCooldowns = new Map<string, number>();
const HEIST_COOLDOWN = 30 * 60 * 1000;
const MIN_HEIST_AMOUNT = 1000;

/** Command handler for `!heist`: Asalto al banco (alto riesgo, alta recompensa). */
export class HeistCommand extends Command {
  name = 'heist';
  description = 'Asalto al banco (alto riesgo, alta recompensa)';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['asalto', 'robo'];
  usage = '!heist <cantidad>';
  examples = ['!heist 10000'];
  cooldown = 1800000;

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastHeist = heistCooldowns.get(ctx.sender.jid);

    if (lastHeist && now - lastHeist < HEIST_COOLDOWN) {
      const remainingMin = Math.ceil((HEIST_COOLDOWN - (now - lastHeist)) / 60000);
      await ctx.reply(
        `🏦 *ASALTO EN COoldown*\n\n` +
          `Debes esperar *${remainingMin} minutos*\n` +
          `antes de planificar otro asalto.`,
      );
      return;
    }

    const amountStr = ctx.args[0];
    const amount = parseInt(amountStr);

    if (!amountStr || isNaN(amount) || amount < MIN_HEIST_AMOUNT) {
      await ctx.reply(
        `🏦 *ASALTO AL BANCO* 🏦\n\n` +
          `✿ *Cómo funciona:*\n` +
          `Invierte dinero en un asalto al banco.\n` +
          `Si tienes éxito, duplicas tu inversión.\n` +
          `Si fail, pierdes todo.\n\n` +
          `📊 *Probabilidad de éxito:*\n` +
          `• $1,000 - $10,000: 45%\n` +
          `• $10,001 - $50,000: 35%\n` +
          `• $50,001 - $100,000: 25%\n` +
          `• $100,001+: 15%\n\n` +
          `💰 Mínimo requerido: $${MIN_HEIST_AMOUNT.toLocaleString()}\n\n` +
          `📝 *Ejemplo:*\n` +
          `!heist 10000`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.money < amount) {
      const bankBalance = user.bank || 0;
      if (bankBalance > 0) {
        await ctx.reply(
          `❌ *No tienes efectivo suficiente*\n\n` +
            `💵 Efectivo: $${formatNumber(user.money)}\n` +
            `🏦 Banco: $${formatNumber(bankBalance)}\n\n` +
            `✿ *Retira dinero primero:*\n` +
            `!withdraw ${amount - user.money}`,
        );
      } else {
        await ctx.reply(
          `❌ *No tienes suficiente dinero*\n\n` +
            `💵 Efectivo: $${formatNumber(user.money)}\n` +
            `💸 Necesitas: $${formatNumber(amount)}`,
        );
      }
      return;
    }

    let successChance = 0.45;
    if (amount > 100000) successChance = 0.15;
    else if (amount > 50000) successChance = 0.25;
    else if (amount > 10000) successChance = 0.35;

    await serviceManager.userService.removeMoney(ctx.sender.jid, amount);

    const success = Math.random() < successChance;

    heistCooldowns.set(ctx.sender.jid, now);

    if (success) {
      const reward = amount * 2;
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);

      const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

      await ctx.reply(
        `🏦 *ASALTO EXITOSO!* 🏦\n\n` +
          `🎉 *LO LOGRASTE!*\n\n` +
          `💰 *GANASTE!*\n` +
          `💸 Invertiste: $${amount.toLocaleString()}\n` +
          `✨ Ganaste: $${reward.toLocaleString()}\n` +
          `📈 Profit: +$${(reward - amount).toLocaleString()}\n\n` +
          `📊 Probabilidad: ${Math.round(successChance * 100)}%\n\n` +
          `💵 Balance: $${formatNumber(updatedUser.money)}`,
      );
      await ctx.react('🎉');
    } else {
      await ctx.reply(
        `🏦 *ASALTO FALLIDO* 🏦\n\n` +
          `💔 *Te atraparon!*\n\n` +
          `💸 Perdiste: $${amount.toLocaleString()}\n\n` +
          `📊 Probabilidad: ${Math.round(successChance * 100)}%\n\n` +
          `⏰ Intenta de nuevo en 30 minutos`,
      );
      await ctx.react('🚨');
    }
  }
}
