/**
 * PrimeCommand.ts
 *
 * admin command `prime` — Activa el modo Prime para este grupo
 * Usage: !prime [on/off/status]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!prime`: Activa el modo Prime para este grupo. */
export class PrimeCommand extends Command {
  name = 'prime';
  description = 'Activa el modo Prime para este grupo';
  category = CommandCategory.ADMIN;
  aliases = ['prime', 'modoprime'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!prime [on/off/status]';
  examples = ['!prime', '!prime on', '!prime off', '!prime status'];
  permissions = { user: [PermissionLevel.OWNER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const action = args[0]?.toLowerCase();

    if (!action || action === 'status') {
      await this.showStatus(ctx);
      return;
    }

    if (action === 'on') {
      await this.enablePrime(ctx);
    } else if (action === 'off') {
      await this.disablePrime(ctx);
    } else {
      await ctx.reply(
        `✘ Uso incorrecto\n\n` +
          `用法: *!prime* [on/off/status]\n\n` +
          `_Ejemplos:_\n` +
          `• !prime - estado actual\n` +
          `• !prime on - activar modo prime\n` +
          `• !prime off - desactivar modo prime`,
      );
    }
  }

  private async showStatus(ctx: MessageContext): Promise<void> {
    const isEnabled = await serviceManager.primeService.isPrimeEnabled(ctx.chat.jid);
    const groupName = await serviceManager.primeService.getGroupName(ctx.sock, ctx.chat.jid);

    const status = isEnabled ? '✅ *MODO PRIME ACTIVADO*' : '❌ *MODO PRIME DESACTIVADO*';
    const icon = isEnabled ? '👑' : '🔒';

    await ctx.reply(
      `${icon} *PRIME - Estado del Grupo*\n\n` +
        `${status}\n\n` +
        `📛 Grupo: *${groupName}*\n\n` +
        `_El modo Prime personaliza el bot con el nombre del grupo._\n\n` +
        `> VaniaBot💝`,
    );
  }

  private async enablePrime(ctx: MessageContext): Promise<void> {
    const isAlreadyEnabled = await serviceManager.primeService.isPrimeEnabled(ctx.chat.jid);

    if (isAlreadyEnabled) {
      await ctx.reply(
        `👑 *MODO PRICE YA ESTÁ ACTIVADO*\n\n` +
          `El bot ya está personalizado para este grupo.\n\n` +
          `> VaniaBot💝`,
      );
      return;
    }

    await serviceManager.primeService.enablePrime(ctx.chat.jid);
    serviceManager.primeService.clearGroupPicCache(ctx.chat.jid);

    const groupName = await serviceManager.primeService.getGroupName(ctx.sock, ctx.chat.jid);

    await ctx.react('👑');
    await ctx.reply(
      `👑 *MODO PRIME ACTIVADO* ✨\n\n` +
        `¡Listo! A partir de ahora el bot usará el nombre de este grupo.\n\n` +
        `📛 *${groupName}* 💝\n\n` +
        `_Activado por @${ctx.sender.pushName || 'owner'}_\n\n` +
        `> ${groupName}💝`,
    );
  }

  private async disablePrime(ctx: MessageContext): Promise<void> {
    const isEnabled = await serviceManager.primeService.isPrimeEnabled(ctx.chat.jid);

    if (!isEnabled) {
      await ctx.reply(
        `🔒 *MODO PRIME YA ESTÁ DESACTIVADO*\n\n` +
          `El bot ya usa su nombre oficial.\n\n` +
          `> VaniaBot💝`,
      );
      return;
    }

    await serviceManager.primeService.disablePrime(ctx.chat.jid);
    serviceManager.primeService.clearGroupPicCache(ctx.chat.jid);

    await ctx.react('🔒');
    await ctx.reply(
      `🔒 *MODO PRIME DESACTIVADO*\n\n` +
        `El bot vuelve a usar su nombre oficial.\n\n` +
        `_Desactivado por @${ctx.sender.pushName || 'owner'}_\n\n` +
        `> VaniaBot💝`,
    );
  }
}
