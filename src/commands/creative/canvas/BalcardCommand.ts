/**
 * BalcardCommand.ts
 *
 * creative command `balcard` — Genera tarjeta de balance
 * Usage: !balcard [accentColor]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { ProfileCardService } from '@services/canvas/ProfileCardService.js';

/** Command handler for `!balcard`: Genera tarjeta de balance. */
export class BalcardCommand extends Command {
  name = 'balcard';
  description = 'Genera tarjeta de balance';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!balcard [accentColor]';
  examples = ['!balcard', '!balcard #FF6B6B'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💳');

    const targetJid = ctx.sender.jid;

    const [userData, progress] = await Promise.all([
      serviceManager.userService.getUser(targetJid),
      serviceManager.levelService.getLevelProgress(targetJid),
    ]);

    const avatarUrl = (await ImageHelper.getProfileImage(ctx)) ?? '';

    const args = ctx.args || [];
    const accentColor = args[0]?.startsWith('#') ? args[0] : undefined;

    const username = (userData.name || ctx.sender.pushName || 'User').substring(0, 20);
    const discriminator = targetJid.split('@')[0].slice(-4);

    try {
      const cardBuffer = await ProfileCardService.generate({
        avatarUrl,
        username,
        discriminator,
        money: userData.money,
        xp: progress.currentXP,
        level: userData.level,
        levelProgress: progress.percentage,
        accentColor,
      });

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: cardBuffer,
        caption: `💳 Balance card de *${username}*`,
      });
    } catch {
      await ctx.reply('❌ No pude generar la tarjeta, intenta de nuevo.');
    }
  }
}
