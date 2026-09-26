import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { getTargetUser, getErrorMessage } from '@/utils/moderationUtils.js';
import { middlewareCache } from '@/middlewares/MiddlewareCache.js';

export class UnmuteCommand extends Command {
  name = 'unmute';
  description = 'Quitar silencio a un usuario';
  category = CommandCategory.MODERATION;
  aliases = ['desmutear'];
  usage = '!unmute @user';
  examples = ['!unmute @user'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('desmutear'));
      return;
    }

    const { jid: mentionedJid } = target;

    await ctx.react('⏳');

    try {
      const targetUser = await serviceManager.userService.getUser(mentionedJid);

      const muteKey = `${ctx.chat.jid}:${mentionedJid}`;
      const wasMuted = middlewareCache.userMuted.get(muteKey);

      if (!wasMuted) {
        await ctx.reply('Este usuario no está muteado');
        await ctx.react('❌');
        return;
      }

      middlewareCache.userMuted.delete(muteKey);
      await serviceManager.moderationService.unmuteUser(ctx.chat.jid, mentionedJid);

      await ctx.reply(
        `*Silence quitado*\n\n` +
          `- Usuario: ${targetUser.name}\n` +
          `- Por: ${ctx.sender.pushName}`,
      );

      await ctx.react('🔊');
    } catch (error: unknown) {
      logError('[UnmuteCommand] Error', error);
      const message = errorMessage(error);
      await ctx.reply(`*Error* ${message}`);
      await ctx.react('❌');
    }
  }
}
