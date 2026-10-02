/**
 * ListBotsCommand.ts
 *
 * subbot command `listbots` — Lista todas las subbots (solo owner)
 * Usage: .listbots
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';

/** Command handler for `!listbots`: Lista todas las subbots (solo owner). */
export class ListBotsCommand extends Command {
  name = 'listbots';
  description = 'Lista todas las subbots (solo owner)';
  category = CommandCategory.SUBBOT;
  // Sin alias 'subbots': es el name de SubBotsCommand (estado de slots).
  aliases = ['allbots'];
  usage = '.listbots';
  examples = ['.listbots'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.OWNER] };

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.sender.isOwner) {
      await ctx.reply('❌ Solo la owner puede usar este comando.');
      return;
    }

    const all = subBotManager.getAllStatus();

    if (all.length === 0) {
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *SubBots registradas*\n` +
          `\n` +
          `🦋 Aún no hay subbots\n` +
          `   registradas en este\n` +
          `   momento.\n` +
          `\n` +
          `✨ Cuando agregues una,\n` +
          `   aparecerá aquí.\n` +
          `\n` +
          `   Estaré esperando 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      return;
    }

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      connecting: '🔄',
      connected: '✅',
      disconnected: '❌',
      error: '⚠️',
    };

    const connected = all.filter(s => s.status === 'connected').length;

    let text =
      `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
      `   *SubBots registradas*\n` +
      `\n` +
      `Total: *${all.length}*\n` +
      `Activas: *${connected}*\n` +
      `───────────────\n` +
      `\n`;

    for (const s of all) {
      text +=
        `${statusEmoji[s.status] ?? '❓'} *${s.name}*\n` +
        `   📞 +${s.phoneNumber}\n` +
        `   🆔 \`${s.id}\`\n\n`;
    }

    text += `_— VaniaBot 🌸_`;

    await ctx.reply(text.trim());
  }
}
