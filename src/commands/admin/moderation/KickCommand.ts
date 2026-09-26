import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  BotPermission,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { getTargetUser, getErrorMessage } from '@/utils/moderationUtils.js';

export class KickCommand extends Command {
  name = 'kick';
  description = 'Kick a user from the group (can rejoin)';
  category = CommandCategory.MODERATION;
  aliases = ['expulsar'];
  usage = '!kick @user [reason]';
  examples = ['!kick @user spam', '!kick @user Breaking rules'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('expulsar'));
      return;
    }

    const { jid: mentionedJid } = target;

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('You cannot kick yourself');
      return;
    }

    if (mentionedJid === ctx.sock.user?.id.split(':')[0] + '@s.whatsapp.net') {
      await ctx.reply('You cannot kick the bot');
      return;
    }

    const targetUser = await serviceManager.userService.getUser(mentionedJid);
    if (targetUser.isOwner) {
      await ctx.reply('You cannot kick an owner');
      return;
    }

    const reason = ctx.args.slice(1).join(' ') || 'No reason provided';

    await ctx.react('⏳');

    try {
      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [mentionedJid], 'remove');

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *se fue* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *quién:* ${targetUser.name}\n` +
          `✩ *por qué:* ${reason}\n` +
          `✩ *por:* ${ctx.sender.pushName}\n` +
          `✩ *cuándo:* ${new Date().toLocaleString()}\n\n` +
          `✿ la puerta no está abierta para volver ✿`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[KickCommand] Error', error);
      const message = errorMessage(error);
      await ctx.reply(`❌ Error kicking user: ${message}`);
      await ctx.react('❌');
    }
  }
}
