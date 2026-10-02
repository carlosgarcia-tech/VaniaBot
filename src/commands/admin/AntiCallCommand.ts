/**
 * AntiCallCommand.ts
 *
 * admin command `anticall` — Activar/desactivar sistema anti-call
 * Usage: !anticall [on|off|status]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { antiCallService } from '@/services/system/AntiCallService.js';
import { getTargetUser } from '@/utils/moderationUtils.js';

/** Command handler for `!anticall`: Activar/desactivar sistema anti-call. */
export class AntiCallCommand extends Command {
  name = 'anticall';
  description = 'Activar/desactivar sistema anti-call';
  category = CommandCategory.ADMIN;
  aliases = ['anticalls', 'nocall'];
  usage = '!anticall [on|off|status]';
  examples = ['!anticall', '!anticall on', '!anticall status'];
  contexts = [CommandContext.BOTH];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action || action === 'status') {
      await this.showStatus(ctx);
      return;
    }

    if (action === 'on' || action === 'activar' || action === 'enable') {
      antiCallService.enable();
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *anti-call* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ activado ✿\n\n` +
          `📵 las llamadas al bot serán rechazadas automáticamente`,
      );
      return;
    }

    if (action === 'off' || action === 'desactivar' || action === 'disable') {
      antiCallService.disable();
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *anti-call* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ desactivado ✿\n\n` +
          `📞 las llamadas ya no serán rechazadas`,
      );
      return;
    }

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *anti-call* ˚₊· ͟͟͞͞➳\n\n` +
        `✿ \`on/off\` para activar/desactivar\n` +
        `✿ \`status\` para ver el estado actual`,
    );
  }

  private async showStatus(ctx: MessageContext): Promise<void> {
    const config = antiCallService.getConfig();
    const status = config.enabled ? '✅ Activado' : '❌ Desactivado';
    const blockedCount = config.blockedUsers.length;

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *anti-call* ˚₊· ͟͟͞͞➳\n\n` +
        `📌 *Estado:* ${status}\n` +
        `📵 *Usuarios bloqueados:* ${blockedCount}\n\n` +
        `*Comandos:*\n` +
        `\`!anticall on\` - Activar\n` +
        `\`!anticall off\` - Desactivar\n` +
        `\`!anticall block @user\` - Bloquear usuario\n` +
        `\`!anticall unblock @user\` - Desbloquear usuario`,
    );
  }
}

export class AntiCallBlockCommand extends Command {
  name = 'anticallblock';
  description = 'Bloquear a un usuario de llamar al bot';
  category = CommandCategory.ADMIN;
  aliases = ['callblock', 'blockcall'];
  usage = '!anticallblock @user';
  examples = ['!anticallblock @usuario'];
  contexts = [CommandContext.BOTH];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *blockcall* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ menciona a un usuario para bloquearlo ✿\n\n` +
          `\`!anticallblock @usuario\``,
      );
      return;
    }

    if (antiCallService.shouldBlock(target.jid)) {
      await ctx.reply(`⚠️ Este usuario ya está bloqueado de llamar`);
      return;
    }

    antiCallService.blockUser(target.jid);
    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *bloqueado* ˚₊· ͟͟͞͞➳\n\n` + `✿ @${target.jid.split('@')[0]} no podrá llamar ✿`,
    );
  }
}

export class AntiCallUnblockCommand extends Command {
  name = 'anticallunblock';
  description = 'Desbloquear a un usuario para que pueda llamar';
  category = CommandCategory.ADMIN;
  aliases = ['callunblock', 'unblockcall'];
  usage = '!anticallunblock @user';
  examples = ['!anticallunblock @usuario'];
  contexts = [CommandContext.BOTH];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *unblockcall* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ menciona a un usuario para desbloquearlo ✿\n\n` +
          `\`!anticallunblock @usuario\``,
      );
      return;
    }

    if (!antiCallService.shouldBlock(target.jid)) {
      await ctx.reply(`⚠️ Este usuario no está bloqueado`);
      return;
    }

    antiCallService.unblockUser(target.jid);
    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *desbloqueado* ˚₊· ͟͟͞͞➳\n\n` + `✿ @${target.jid.split('@')[0]} ya puede llamar ✿`,
    );
  }
}

export default [AntiCallCommand, AntiCallBlockCommand, AntiCallUnblockCommand];
