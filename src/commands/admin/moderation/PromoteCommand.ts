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
import { cacheManager } from '@/core/CacheManager.js';
import { getTargetUser, getErrorMessage } from '@/utils/moderationUtils.js';

export class PromoteCommand extends Command {
  name = 'promote';
  description = 'Promote a user to admin';
  category = CommandCategory.MODERATION;
  aliases = ['promover', 'admin'];
  usage = '!promote @user';
  examples = ['!promote @user'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('promover'));
      return;
    }

    const { jid: mentionedJid } = target;

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('❌ You cannot promote yourself');
      return;
    }

    if (mentionedJid === ctx.sock.user?.id.split(':')[0] + '@s.whatsapp.net') {
      await ctx.reply('The bot is already an admin');
      return;
    }

    await ctx.react('⏳');

    try {
      const groupMetadata = await cacheManager.getGroupMetadataSafe(ctx.sock, ctx.chat.jid);
      const participant = groupMetadata.participants.find(p => p.id === mentionedJid);

      if (!participant) {
        await ctx.reply('❌ User not found in group');
        return;
      }

      if (participant.admin === 'admin' || participant.admin === 'superadmin') {
        await ctx.reply('⚠️ This user is already an admin');
        return;
      }

      const targetUser = await serviceManager.userService.getUser(mentionedJid);

      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [mentionedJid], 'promote');

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *subió de rango* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *quién:* ${targetUser.name}\n` +
          `✩ *ahora es:* admin\n` +
          `✩ *por:* ${ctx.sender.pushName}\n` +
          `✩ *cuándo:* ${new Date().toLocaleString()}\n\n` +
          `✿ ya puede ayudar a cuidar el grupo ✿`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[PromoteCommand] Error', error);
      const message = errorMessage(error);
      await ctx.reply(`❌ Error promoting user: ${message}`);
      await ctx.react('❌');
    }
  }
}
