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

export class UnbanCommand extends Command {
  name = 'unban';
  description = 'Unban a user from the group';
  category = CommandCategory.MODERATION;
  aliases = ['desbanear'];
  usage = '!unban @user';
  examples = ['!unban @user'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('desbanear'));
      return;
    }

    const { jid: mentionedJid } = target;

    await ctx.react('⏳');

    try {
      const banInfo = await serviceManager.moderationService.getBanInfo(ctx.chat.jid, mentionedJid);

      if (!banInfo) {
        await ctx.reply('⚠️ This user is not banned');
        return;
      }

      await serviceManager.moderationService.unbanUser(ctx.chat.jid, mentionedJid);

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *de vuelta* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *quién:* ${banInfo.userName}\n` +
          `✩ *por:* ${ctx.sender.pushName}\n` +
          `✩ *cuándo:* ${new Date().toLocaleString()}`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[UnbanCommand] Error', error);
      const message = errorMessage(error);
      await ctx.reply(`❌ Error unbanning user: ${message}`);
      await ctx.react('❌');
    }
  }
}
