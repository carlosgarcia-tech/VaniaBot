/**
 * LicenseCommands.ts
 *
 * owner command `setplan` — Asignar o cambiar plan de licencia (Owner only)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, PermissionLevel, type MessageContext } from '@/types/index.js';
import { licenseService } from '@/services/system/LicenseService.js';

/** Command handler for `!setplan`: Asignar o cambiar plan de licencia (Owner only). */
export class SetPlanCommand extends Command {
  name = 'setplan';
  description = 'Asignar o cambiar plan de licencia (Owner only)';
  aliases = ['asignarplan', 'activarplan', 'cambiarplan'];
  category = CommandCategory.OWNER;
  permissions = { user: [PermissionLevel.OWNER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length < 2) {
      await this.showHelp(ctx);
      return;
    }

    const targetJid = args[0];
    const planType = args[1].toLowerCase() as 'permanent' | 'monthly';
    const botsCount = parseInt(args[2]) || 1;

    if (!['permanent', 'monthly'].includes(planType)) {
      await ctx.reply(`❌ Plan inválido. Usa: permanent o monthly`);
      return;
    }

    if (botsCount < 1 || botsCount > 5) {
      await ctx.reply(`❌ Cantidad de bots inválida (1-5)`);
      return;
    }

    const prices = licenseService.getPlanPrices();
    const planPrices = planType === 'permanent' ? prices.permanent : prices.monthly;
    const price = planPrices[botsCount as keyof typeof planPrices];
    const paymentType = planType === 'permanent' ? 'single' : 'subscription';

    const success = await licenseService.activateLicense(
      targetJid,
      planType,
      paymentType,
      price.toString(),
      botsCount,
    );

    if (success) {
      const planLabel = planType === 'permanent' ? '💎 Permanente' : '📅 Mensual';
      const expiryText =
        planType === 'monthly'
          ? `\n*Vence:* ${new Date(Date.now() + botsCount * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX')}`
          : '';

      await ctx.reply(
        `✅ *Plan Activado*\n\n• *Grupo:* ${targetJid}\n• *Plan:* ${planLabel}\n• *Bots:* ${botsCount}\n• *Precio:* $${price} MXN${expiryText}`,
      );
    } else {
      await ctx.reply(`❌ Error al activar plan. Verifica que el grupo existe.`);
    }
  }

  private async showHelp(ctx: MessageContext): Promise<void> {
    let help = `📋 *SetPlan - Asignar Plan de Licencia*\n\n`;
    help += `*用法:* .setplan <jid> <permanent|monthly> <bots>\n\n`;
    help += `*Ejemplos:*\n`;
    help += `• .setplan 5215555555555@g.us permanent 1\n`;
    help += `• .setplan 5215555555555@g.us monthly 3\n\n`;
    help += `*Precios:*\n`;
    help += `┌─ Permanente ─┐\n`;
    help += `│ 1 bot: $100   │\n`;
    help += `│ 3 bots: $250 │\n`;
    help += `│ 5 bots: $400  │\n`;
    help += `├─ Mensual ────┤\n`;
    help += `│ 1 bot: $60   │\n`;
    help += `│ 3 bots: $150 │\n`;
    help += `│ 5 bots: $250 │\n`;
    help += `└─────────────┘`;

    await ctx.reply(help);
  }
}

export class VerPlanCommand extends Command {
  name = 'verplan';
  description = 'Ver plan de licencia de un grupo (Owner only)';
  aliases = ['checkplan', 'infoplan'];
  category = CommandCategory.OWNER;
  permissions = { user: [PermissionLevel.OWNER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const targetJid = ctx.args.length > 0 ? ctx.args[0] : ctx.chat.isGroup ? ctx.chat.jid : null;

    if (!targetJid) {
      await ctx.reply(`*用法:* .verplan [jid]\n*Ejemplo:* .verplan 5215555555555@g.us`);
      return;
    }

    const licenseInfo = await licenseService.getLicenseInfo(targetJid);
    await ctx.reply(`📋 *Información de Licencia*\n\n${targetJid}\n${licenseInfo}`);
  }
}

export class CancelLicenseCommand extends Command {
  name = 'cancelar';
  description = 'Cancelar licencia de grupo (Owner only)';
  aliases = ['desactivar', 'banlicencia'];
  category = CommandCategory.OWNER;
  permissions = { user: [PermissionLevel.OWNER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const targetJid = ctx.args[0];

    if (!targetJid) {
      await ctx.reply(`*用法:* .cancelar <jid>\n*Ejemplo:* .cancelar 5215555555555@g.us`);
      return;
    }

    const success = await licenseService.cancelLicense(targetJid);

    if (success) {
      await ctx.reply(
        `✅ *Licencia cancelada*\n\n• *Grupo:* ${targetJid}\n• *Estado:* Deshabilitado`,
      );
    } else {
      await ctx.reply(`❌ Error al cancelar licencia.`);
    }
  }
}
