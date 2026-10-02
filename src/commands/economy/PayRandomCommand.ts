/**
 * PayRandomCommand.ts
 *
 * economy command `payrandom` — Envía una cantidad aleatoria a un usuario aleatorio (Solo Owner)
 * Usage: !payrandom <cantidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!payrandom`: Envía una cantidad aleatoria a un usuario aleatorio (Solo Owner). */
export class PayRandomCommand extends Command {
  name = 'payrandom';
  description = 'Envía una cantidad aleatoria a un usuario aleatorio (Solo Owner)';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['payr', 'regalo', 'giveaway'];
  usage = '!payrandom <cantidad>';
  examples = ['!payrandom 1000000'];
  permissions = { user: [PermissionLevel.OWNER] };

  async execute(ctx: MessageContext): Promise<void> {
    const amountStr = ctx.args[0];
    const amount = parseInt(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
      await ctx.reply(
        `🎁 *PAGO ALEATORIO* 🎁\n\n` +
          `✿ *Cómo funciona:*\n` +
          `El bot elige un usuario al azar\n` +
          `de todos los usuarios registrados\n` +
          `y le envía la cantidad especificada.\n\n` +
          `💰 *Cantidad:* La que tú definas\n\n` +
          `📝 *Ejemplo:*\n` +
          `!payrandom 1000000`,
      );
      return;
    }

    const allUsers = await serviceManager.userService.getAllUsers();
    const eligibleUsers = allUsers.filter(u => !u.isOwner && !u.isBanned);

    if (eligibleUsers.length === 0) {
      await ctx.reply(`❌ No hay usuarios elegibles para recibir el regalo`);
      return;
    }

    const randomUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];

    await serviceManager.userService.addMoney(randomUser.jid, amount);

    const sender = await serviceManager.userService.getUser(ctx.sender.jid);

    await ctx.reply(
      `🎁 *PAGO ALEATORIO ENVIADO* 🎁\n\n` +
        `✨ *¡Felicidades!*\n\n` +
        `💰 *Cantidad:* $${formatNumber(amount)}\n\n` +
        `🎯 *Ganador:* ${randomUser.name}\n` +
        `📱 *JID:* @${randomUser.jid.split('@')[0]}\n\n` +
        `💝 *Enviado por:* ${sender.name}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *Total usuarios:* ${eligibleUsers.length}\n` +
        `🎲 *Probabilidad:* ${((1 / eligibleUsers.length) * 100).toFixed(2)}%`,
    );

    try {
      await ctx.sock.sendMessage(randomUser.jid, {
        text:
          `🎁 *¡RECIBISTE UN REGALO!* 🎁\n\n` +
          `💰 *Cantidad:* $${formatNumber(amount)}\n\n` +
          `✨ *Te lo envía:* ${sender.name}\n\n` +
          `🎉 *¡Felicidades!*\n\n` +
          `> _*VaniaBot💝*_`,
      });
    } catch (error) {
      // El pago ya se hizo: solo falla el aviso al receptor. Queda registrado.
      logError(`[PayRandomCommand] Could not notify winner ${randomUser.jid}`, error);
    }
  }
}
