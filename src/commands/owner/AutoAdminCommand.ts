/**
 * AutoAdminCommand.ts
 *
 * owner command `autoadmin` — Automatically promote yourself to admin (owner only)
 * Usage: !autoadmin
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
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

/** Command handler for `!autoadmin`: Automatically promote yourself to admin (owner only). */
export class AutoAdminCommand extends Command {
  name = 'autoadmin';
  description = 'Automatically promote yourself to admin (owner only)';
  category = CommandCategory.OWNER;
  aliases = ['sadmin', 'makeadmin'];
  usage = '!autoadmin';
  examples = ['!autoadmin'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.OWNER],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const ownerJid = ctx.sender.jid;

      const groupMetadata = await cacheManager.getGroupMetadataSafe(ctx.sock, ctx.chat.jid);
      const participant = groupMetadata.participants.find(p => p.id === ownerJid);

      if (!participant) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *oops, un pequeño error* ˚₊· ͟͟͞͞➳\n\n` +
            `✿ no te encuentro en este grupo\n` +
            `✩ esto no debería pasar... perdóname ✩`,
        );
        return;
      }

      const isAlreadyAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';

      if (isAlreadyAdmin) {
        const role = participant.admin === 'superadmin' ? 'Group Creator' : 'Admin';

        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *ya tienes poderes* ˚₊· ͟͟͞͞➳\n\n` +
            `✿ ${ctx.sender.pushName}\n` +
            `✩ rol: ${role}\n\n` +
            `♡ ya eres admin, lindo ♡`,
        );
        return;
      }

      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [ownerJid], 'promote');

      await serviceManager.moderationService.logAction({
        userId: ownerJid,
        userName: ctx.sender.pushName || 'Owner',
        action: 'warn',
        reason: 'Self-promotion via autoadmin (owner privilege)',
        moderator: 'System',
        timestamp: Date.now(),
      });

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *te dieron podercitos* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ ${ctx.sender.pushName}\n` +
          `✩ ahora eres admin\n` +
          `♡ con poderes de owner ♡\n\n` +
          `> ${new Date().toLocaleString()}`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[AutoAdminCommand] Error', error);

      let errorMsg = `❌ *Auto-Admin Failed*\n\n`;
      const errorObj = error instanceof Error ? error : new Error('Unknown error');

      if (errorObj.message?.includes('not-authorized')) {
        errorMsg +=
          `*Bot is not admin*\n\n` +
          `Solution:\n` +
          `1. Make the bot admin first\n` +
          `2. Then use !autoadmin`;
      } else if (errorObj.message?.includes('forbidden')) {
        errorMsg +=
          `*Bot lacks permissions*\n\n` + `The bot needs admin permissions to promote users`;
      } else {
        errorMsg +=
          `⚠️ ${errorObj.message}\n\n` +
          `📝 Common issues:\n` +
          `• Bot must be admin\n` +
          `• You must be in the group\n` +
          `• WhatsApp API limitations`;
      }

      await ctx.reply(errorMsg);
      await ctx.react('❌');
    }
  }
}
