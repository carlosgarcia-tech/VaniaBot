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

export class DemoteCommand extends Command {
  name = 'demote';
  description = 'Demote an admin to regular user';
  category = CommandCategory.MODERATION;
  aliases = ['degradar', 'deadmin'];
  usage = '!demote @user';
  examples = ['!demote @user'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('degradar'));
      return;
    }

    const { jid: mentionedJid } = target;

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('❌ You cannot demote yourself');
      return;
    }

    if (mentionedJid === ctx.sock.user?.id.split(':')[0] + '@s.whatsapp.net') {
      await ctx.reply('❌ You cannot demote the bot');
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

      if (!participant.admin || participant.admin === null) {
        await ctx.reply('⚠️ This user is not an admin');
        return;
      }

      if (participant.admin === 'superadmin') {
        await ctx.reply('❌ You cannot demote the group creator');
        return;
      }

      const targetUser = await serviceManager.userService.getUser(mentionedJid);

      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [mentionedJid], 'demote');

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *bajó de rango* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *quién:* ${targetUser.name}\n` +
          `✩ *ahora es:* miembro\n` +
          `✩ *por:* ${ctx.sender.pushName}\n` +
          `✩ *cuándo:* ${new Date().toLocaleString()}\n\n` +
          `✿ ya es parte del grupo ✿`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[DemoteCommand] Error', error);
      const message = errorMessage(error);
      await ctx.reply(`❌ Error demoting user: ${message}`);
      await ctx.react('❌');
    }
  }
}
