/**
 * MutelistCommand.ts
 *
 * moderation command `mutelist` — Ver lista de usuarios muteados en el grupo
 * Usage: !mutelist [@user]
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
import { getTargetUser, getErrorMessage } from '@/utils/moderationUtils.js';

/** Command handler for `!mutelist`: Ver lista de usuarios muteados en el grupo. */
export class MutelistCommand extends Command {
  name = 'mutelist';
  description = 'Ver lista de usuarios muteados en el grupo';
  category = CommandCategory.MODERATION;
  aliases = ['mutelist', 'silenciados', 'listamute'];
  usage = '!mutelist [@user]';
  examples = ['!mutelist', '!mutelist @usuario'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (target) {
      await this.showUserMuteStatus(ctx, target.jid);
      return;
    }

    await this.showGroupMuteList(ctx);
  }

  private async showGroupMuteList(ctx: MessageContext): Promise<void> {
    try {
      const mutes = await serviceManager.moderationService.getGroupMutes(ctx.chat.jid);

      if (mutes.length === 0) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *silenciados* ˚₊· ͟͟͞͞➳\n\n` +
            `✿ no hay nadie silenciado ✿\n\n` +
            `✨ el grupo está en paz`,
        );
        return;
      }

      let message = `˚₊· ͟͟͞͞➳ *silenciados* ˚₊· ͟͟͞͞➳\n\n`;
      message += `✿ ${mutes.length} usuario${mutes.length !== 1 ? 's' : ''} silenciado${mutes.length !== 1 ? 's' : ''}\n\n`;

      for (const mute of mutes) {
        const remaining = this.formatRemainingTime(mute.expiresAt - Date.now());
        const date = new Date(mute.timestamp).toLocaleDateString();
        const userNum = mute.userId.split('@')[0];

        message += `👤 @${userNum}\n`;
        message += `   ⏰ ${remaining}\n`;
        message += `   📝 ${mute.reason}\n`;
        message += `   🕐 Desde: ${date}\n\n`;
      }

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener la lista de muteados.');
    }
  }

  private async showUserMuteStatus(ctx: MessageContext, userJid: string): Promise<void> {
    try {
      const muteInfo = await serviceManager.moderationService.getMuteInfo(ctx.chat.jid, userJid);

      if (!muteInfo) {
        const user = await serviceManager.userService.getUser(userJid);
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *${user.name}* ˚₊· ͟͟͞͞➳\n\n` + `✿ puede hablar libremente ✿\n\n` + `✨ no tiene mute`,
        );
        return;
      }

      const remaining = this.formatRemainingTime(muteInfo.expiresAt - Date.now());
      const date = new Date(muteInfo.timestamp).toLocaleString();
      const muterNum = muteInfo.mutedBy.split('@')[0];

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *silenciado* ˚₊· ͟͟͞͞➳\n\n` +
          `👤 @${userJid.split('@')[0]}\n\n` +
          `✩ *por:* @${muterNum}\n` +
          `✩ *razón:* ${muteInfo.reason}\n` +
          `✩ *duración:* ${remaining}\n` +
          `✩ *desde:* ${date}`,
      );
    } catch {
      await ctx.reply('❌ Error al obtener el estado de mute.');
    }
  }

  private formatRemainingTime(ms: number): string {
    if (ms <= 0) return 'Expirado';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

export class MuteStatusCommand extends Command {
  name = 'mutestatus';
  description = 'Verificar si un usuario está muteado';
  category = CommandCategory.MODERATION;
  aliases = ['mstatus', 'estamute'];
  usage = '!mutestatus @user';
  examples = ['!mutestatus @usuario'];
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('verificar mute'));
      return;
    }

    const muteInfo = await serviceManager.moderationService.getMuteInfo(ctx.chat.jid, target.jid);

    if (!muteInfo) {
      await ctx.reply(`✅ @${target.jid.split('@')[0]} puede hablar.`);
      return;
    }

    const remaining = this.formatRemainingTime(muteInfo.expiresAt - Date.now());
    await ctx.reply(`⏰ @${target.jid.split('@')[0]} está muteado por ${remaining}`);
  }

  private formatRemainingTime(ms: number): string {
    if (ms <= 0) return 'Expirado';

    const minutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} día${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours !== 1 ? 's' : ''}`;
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }
}

export default [MutelistCommand, MuteStatusCommand];
