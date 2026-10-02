/**
 * MiPlanCommand.ts
 *
 * utility command `miplan` — Ver información de tu licencia actual
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, PermissionLevel, type MessageContext } from '@/types/index.js';
import { licenseService } from '@/services/system/LicenseService.js';

/** Command handler for `!miplan`: Ver información de tu licencia actual. */
export class MiPlanCommand extends Command {
  name = 'miplan';
  description = 'Ver información de tu licencia actual';
  aliases = ['plan', 'licencia', 'sub'];
  category = CommandCategory.UTILITY;
  cooldown = 5000;
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.chat.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }
    const licenseInfo = await licenseService.getLicenseInfo(ctx.chat.jid);
    await ctx.reply(`📋 *Información de tu Plan*\n\n${licenseInfo}`);
  }
}

export class RenovarCommand extends Command {
  name = 'renovar';
  description = 'Renovar licencia mensual';
  aliases = ['renovarplan', 'extend'];
  category = CommandCategory.UTILITY;
  cooldown = 10000;
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.chat.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    const meses = parseInt(ctx.args[0]) || 1;
    const mesesValidos = [1, 3, 5];

    if (!mesesValidos.includes(meses)) {
      const help = `📅 *Renovar Plan Mensual*\n\n*用法:* .renovar <meses>\n*Ejemplo:* .renovar 1\n\n*Opciones:*\n• 1 mes  — $60 MXN\n• 3 meses — $150 MXN\n• 5 meses — $250 MXN\n\n⚠️ Contacta al admin para procesar el pago.`;
      await ctx.reply(help);
      return;
    }

    const prices = licenseService.getPlanPrices();
    const price = prices.monthly[meses as keyof typeof prices.monthly];
    const success = await licenseService.renewLicense(ctx.chat.jid, meses, price.toString());

    if (success) {
      const newExpiry = new Date();
      newExpiry.setMonth(newExpiry.getMonth() + meses);
      await ctx.reply(
        `✅ *Licencia Renovada*\n\n• *Duración:* ${meses} mes(es)\n• *Precio:* $${price} MXN\n• *Nueva fecha:* ${newExpiry.toLocaleDateString('es-MX')}\n\n💳 Confirma tu pago con el admin.`,
      );
    } else {
      await ctx.reply(
        `❌ Error al renovar.\n\nPossible reasons:\n• Tu plan es permanente\n• Grupo no registrado\n\nContacta al admin.`,
      );
    }
  }
}
