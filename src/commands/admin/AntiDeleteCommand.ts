/**
 * AntiDeleteCommand.ts
 *
 * admin command `antidelete` — Activar/desactivar sistema anti-delete
 * Usage: !antidelete [on|off|status]
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
import { antiDeleteService } from '@/services/system/AntiDeleteService.js';

/** Command handler for `!antidelete`: Activar/desactivar sistema anti-delete. */
export class AntiDeleteCommand extends Command {
  name = 'antidelete';
  description = 'Activar/desactivar sistema anti-delete';
  category = CommandCategory.ADMIN;
  aliases = ['antidel', 'ad'];
  usage = '!antidelete [on|off|status]';
  examples = ['!antidelete', '!antidelete on', '!antidelete status'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();
    const groupJid = ctx.chat.jid;

    if (!action || action === 'status') {
      await this.showStatus(ctx, groupJid);
      return;
    }

    if (action === 'on' || action === 'activar' || action === 'enable') {
      antiDeleteService.enable(groupJid);
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *anti-delete* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ activado ✿\n\n` +
          `ahora se notificará al owner cuando alguien elimine un mensaje`,
      );
      return;
    }

    if (action === 'off' || action === 'desactivar' || action === 'disable') {
      antiDeleteService.disable(groupJid);
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *anti-delete* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ desactivado ✿\n\n` +
          `los mensajes eliminados ya no se notificarán`,
      );
      return;
    }

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *anti-delete* ˚₊· ͟͟͞͞➳\n\n` +
        `✿ \`on/off\` para activar/desactivar\n` +
        `✿ \`status\` para ver el estado actual`,
    );
  }

  private async showStatus(ctx: MessageContext, groupJid: string): Promise<void> {
    const config = antiDeleteService.getConfig();
    const groupEnabled = config.groups[groupJid] !== false;
    const globalEnabled = config.enabled;

    const status = globalEnabled && groupEnabled ? '✅ Activado' : '❌ Desactivado';

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *anti-delete* ˚₊· ͟͟͞͞➳\n\n` +
        `📌 *Estado:* ${status}\n\n` +
        `✿ Este grupo: ${groupEnabled ? '✅' : '❌'}\n` +
        `✿ Global: ${globalEnabled ? '✅' : '❌'}\n\n` +
        `*Comandos:*\n` +
        `\`!antidelete on\` - Activar\n` +
        `\`!antidelete off\` - Desactivar`,
    );
  }
}

export class AntiDeleteGlobalCommand extends Command {
  name = 'antideleteglobal';
  description = 'Activar/desactivar anti-delete globalmente (solo owner)';
  category = CommandCategory.OWNER;
  aliases = ['adglobal', 'antidelglobal'];
  usage = '!antideleteglobal [on|off]';
  contexts = [CommandContext.BOTH];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action) {
      const config = antiDeleteService.getConfig();
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *anti-delete global* ˚₊· ͟͟͞͞➳\n\n` +
          `📌 *Estado:* ${config.enabled ? '✅ Activado' : '❌ Desactivado'}\n\n` +
          `*Comandos:*\n` +
          `\`!antideleteglobal on\` - Activar globalmente\n` +
          `\`!antideleteglobal off\` - Desactivar globalmente`,
      );
      return;
    }

    if (action === 'on' || action === 'enable') {
      antiDeleteService.enable();
      await ctx.reply(`✅ Anti-delete global activado`);
      return;
    }

    if (action === 'off' || action === 'disable') {
      antiDeleteService.disable();
      await ctx.reply(`❌ Anti-delete global desactivado`);
      return;
    }
  }
}

export default [AntiDeleteCommand, AntiDeleteGlobalCommand];
