/**
 * SetOwnerCommand.ts
 *
 * owner command `setowner` — Grant or remove owner permissions
 * Usage: !setowner <add|remove> <@user>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { checkPinVerification } from '@/utils/pinVerificationHelper.js';

/** Command handler for `!setowner`: Grant or remove owner permissions. */
export class SetOwnerCommand extends Command {
  name = 'setowner';
  description = 'Grant or remove owner permissions';
  category = CommandCategory.OWNER;
  aliases = ['makeowner', 'removeowner', 'owner'];
  usage = '!setowner <add|remove> <@user>';
  examples = ['!setowner add @5215551234567', '!setowner remove @5215551234567'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    const argsString = ctx.args.join(' ');

    const { requiresPin: _requiresPin, canExecute } = await checkPinVerification(
      ctx,
      'setowner',
      argsString,
    );
    if (!canExecute) {
      return;
    }

    if (args.length < 2) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, algo no está bien* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ así lo haces: ${this.usage}\n\n` +
          `✩ *ejemplos:*\n${this.examples.map(ex => `  ﹒${ex}`).join('\n')}`,
      );
      return;
    }

    const action = args[0].toLowerCase();
    const mentionedJid = ctx.mentionedJid;

    if (!mentionedJid) {
      await ctx.reply(' You must mention a user');
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply(' You cannot modify your own owner permissions');
      return;
    }

    try {
      const targetUser = await serviceManager.userService.getUser(mentionedJid);

      switch (action) {
        case 'add':
        case 'grant':
        case 'give':
          if (targetUser.isOwner) {
            await ctx.reply(`⚠️ ${targetUser.name} is already an owner`);
            return;
          }

          const oldStats = {
            level: targetUser.level,
            xp: targetUser.xp,
            money: targetUser.money,
          };

          await serviceManager.userService.setOwner(mentionedJid, true);

          const updatedUser = await serviceManager.userService.getUser(mentionedJid);

          await ctx.reply(
            `˚₊· ͟͟͞͞➳ *${targetUser.name} ahora es owner* ˚₊· ͟͟͞͞➳\n\n` +
              `✩ *lo que puede hacer:*\n` +
              `  ﹒todo lo que quiera\n` +
              `  ﹒recursos sin fin\n` +
              `  ﹒stats al tope\n` +
              `  ﹒sin límites\n` +
              `  ﹒no recibe warns ni bans\n\n` +
              `✿ *subió así:*\n` +
              `  ﹒nivel: ${oldStats.level} → ${updatedUser.level}\n` +
              `  ﹒XP: ${oldStats.xp.toLocaleString()} → ${updatedUser.xp.toLocaleString()}\n` +
              `  ﹒dinero: $${oldStats.money.toLocaleString()} → $${updatedUser.money.toLocaleString()} ✿`,
          );
          break;

        case 'remove':
        case 'revoke':
        case 'take':
          if (!targetUser.isOwner) {
            await ctx.reply(`⚠️ ${targetUser.name} is not an owner`);
            return;
          }

          const beforeRemoval = {
            level: targetUser.level,
            xp: targetUser.xp,
            money: targetUser.money,
          };

          await serviceManager.userService.setOwner(mentionedJid, false);

          const demotedUser = await serviceManager.userService.getUser(mentionedJid);

          await ctx.reply(
            `˚₊· ͟͟͞͞➳ *${targetUser.name} perdió sus podercitos* ˚₊· ͟͟͞͞➳\n\n` +
              `✩ *esto cambió:*\n` +
              `  ﹒nivel: ${beforeRemoval.level} → ${demotedUser.level}\n` +
              `  ﹒XP: ${beforeRemoval.xp.toLocaleString()} → ${demotedUser.xp.toLocaleString()}\n` +
              `  ﹒dinero: $${beforeRemoval.money.toLocaleString()} → $${demotedUser.money.toLocaleString()}\n\n` +
              `♡ volvió a sus valores iniciales ♡`,
          );
          break;

        default:
          await ctx.reply(' Invalid action. Use: add or remove');
      }
    } catch (error) {
      logError('[SetOwnerCommand] Error', error);
      await ctx.reply(` Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}
