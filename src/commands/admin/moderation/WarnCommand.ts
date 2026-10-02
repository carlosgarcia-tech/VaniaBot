/**
 * WarnCommand.ts
 *
 * admin command `warn` — Warn a user (3 warnings = automatic kick)
 * Usage: !warn @user [reason]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { getTargetUser, getErrorMessage } from '@/utils/moderationUtils.js';

/** Command handler for `!warn`: Warn a user (3 warnings = automatic kick). */
export class WarnCommand extends Command {
  name = 'warn';
  description = 'Warn a user (3 warnings = automatic kick)';
  category = CommandCategory.ADMIN;
  aliases = ['warn'];
  usage = '!warn @user [reason]';
  examples = ['!warn @user spam', '!warn @user excessive mentions'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('advertir'));
      return;
    }

    const { jid: mentionedJid } = target;

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('You cannot warn yourself.');
      return;
    }

    const reason = ctx.args.slice(1).join(' ') || 'No reason provided';

    const newWarnings = await serviceManager.userService.addWarning(mentionedJid);

    const user = await serviceManager.userService.getUser(mentionedJid);

    if (newWarnings >= 3) {
      if (ctx.chat.isBotAdmin) {
        try {
          await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [mentionedJid], 'remove');

          await ctx.reply(
            `˚₊· ͟͟͞͞➳ *se tuvo que ir* ˚₊· ͟͟͞͞➳\n\n` +
              `✩ *quién:* ${user.name}\n` +
              `✩ *advertencias:* 3/3\n` +
              `✩ *por:* ${reason}`,
          );
        } catch {
          await ctx.reply('Could not kick the user (missing permissions?).');
        }
      } else {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *ya tenía muchas* ˚₊· ͟͟͞͞➳\n\n` +
            `✩ *quién:* ${user.name}\n` +
            `✩ *advertencias:* 3/3\n` +
            `✩ *por:* ${reason}\n\n` +
            `✿ ay, no soy admin, no pude hacer nada ✿`,
        );
      }
    } else {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *una notita* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *quién:* ${user.name}\n` +
          `✩ *lleva:* ${newWarnings}/3\n` +
          `✩ *por:* ${reason}\n\n` +
          `✿ cuidado, a las 3 se tiene que ir ✿`,
      );
    }
  }
}
