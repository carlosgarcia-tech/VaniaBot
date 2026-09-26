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

export class BanCommand extends Command {
  name = 'ban';
  description = 'Ban a user from the group';
  category = CommandCategory.MODERATION;
  aliases = ['banear'];
  usage = '!ban @user [reason]';
  examples = ['!ban @user spam', '!ban @user Breaking rules'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('banear'));
      return;
    }

    const { jid: mentionedJid } = target;

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('❌ You cannot ban yourself');
      return;
    }

    if (mentionedJid === ctx.sock.user?.id.split(':')[0] + '@s.whatsapp.net') {
      await ctx.reply('❌ You cannot ban the bot');
      return;
    }

    const targetUser = await serviceManager.userService.getUser(mentionedJid);
    if (targetUser.isOwner) {
      await ctx.reply('❌ You cannot ban an owner');
      return;
    }

    await ctx.react('⏳');

    try {
      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [mentionedJid], 'remove');

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *baneadito* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *quién:* ${targetUser.name}\n` +
          `✩ *quién lo hizo:* ${ctx.sender.pushName}\n` +
          `✩ *cuándo:* ${new Date().toLocaleString()}`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[BanCommand] Error', error);
      const message = errorMessage(error);
      await ctx.reply(`❌ Error banning user: ${message}`);
      await ctx.react('❌');
    }
  }
}
