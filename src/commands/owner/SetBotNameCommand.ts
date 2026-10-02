/**
 * SetBotNameCommand.ts
 *
 * owner command `setbotname` — Cambia el nombre del bot
 * Usage: !setbotname <nombre>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

/** Command handler for `!setbotname`: Cambia el nombre del bot. */
export class SetBotNameCommand extends Command {
  name = 'setbotname';
  description = 'Cambia el nombre del bot';
  category = CommandCategory.OWNER;
  aliases = ['botname', 'setnamebot', 'setnombrebot'];
  usage = '!setbotname <nombre>';
  examples = ['!setbotname Vania Bot', '!setbotname Mi Bot'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const newName = ctx.args.join(' ').trim().replace(/\s+/g, ' ');

    if (!newName) {
      await ctx.reply(
        '*SETBOTNAME*\n\n' +
          'Cambia el nombre del bot.\n\n' +
          'Uso: !setbotname <nombre>\n' +
          'Ejemplo: !setbotname Vania Bot',
      );
      return;
    }

    const truncatedName = newName.slice(0, 60);

    try {
      await ctx.sock.updateProfileName(truncatedName);
      await ctx.reply(`✅ Nombre del bot actualizado a: *${truncatedName}*`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.reply(`❌ No pude cambiar el nombre.\n\n${errorMessage}`);
    }
  }
}
