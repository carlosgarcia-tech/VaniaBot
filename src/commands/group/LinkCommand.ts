/**
 * LinkCommand.ts
 *
 * group command `link` — Obtener el enlace de invitación del grupo
 * Usage: !link
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!link`: Obtener el enlace de invitación del grupo. */
export class LinkCommand extends Command {
  name = 'link';
  description = 'Obtener el enlace de invitación del grupo';
  category = CommandCategory.GROUP;
  aliases = ['grouplink', 'invitelink'];
  usage = '!link';
  examples = ['!link'];
  cooldown = 5000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const code = await ctx.sock.groupInviteCode(ctx.chat.jid);
      const link = `https://chat.whatsapp.com/${code}`;

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *enlace del grupo* ˚₊· ͟͟͞͞➳\n\n` +
          `🔗 ${link}\n\n` +
          `✿ Comparte este enlace para invitar a otros ✩`,
      );
    } catch (error) {
      logError('[LinkCommand] Error:', error);
      await ctx.reply(
        '˚₊· ͟͟͞͞➳ *ups, algo salió mal* ˚₊· ͟͟͞͞➳\n\n' +
          '❌ No pude obtener el enlace. Asegúrate de que soy administrador del grupo.',
      );
    }
  }
}
