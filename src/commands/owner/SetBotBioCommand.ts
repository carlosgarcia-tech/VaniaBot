/**
 * SetBotBioCommand.ts
 *
 * owner command `setbotbio` — Cambia el estado/bio del bot
 * Usage: !setbotbio <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

/** Command handler for `!setbotbio`: Cambia el estado/bio del bot. */
export class SetBotBioCommand extends Command {
  name = 'setbotbio';
  description = 'Cambia el estado/bio del bot';
  category = CommandCategory.OWNER;
  aliases = ['botbio', 'setbio', 'biodat'];
  usage = '!setbotbio <texto>';
  examples = ['!setbotbio 🌸 Tu bot favorito', '!setbotbio Online 24/7'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const newBio = ctx.args.join(' ').trim().replace(/\s+/g, ' ');

    if (!newBio) {
      await ctx.reply(
        '*SETBOTBIO*\n\n' +
          'Cambia el estado o bio del bot (max 139 caracteres).\n\n' +
          'Uso: !setbotbio <texto>\n' +
          'Ejemplo: !setbotbio 🌸 Tu bot favorito',
      );
      return;
    }

    const truncatedBio = newBio.slice(0, 139);

    try {
      if (typeof ctx.sock.updateProfileStatus !== 'function') {
        throw new Error('Este entorno no soporta cambiar bio.');
      }

      await ctx.sock.updateProfileStatus(truncatedBio);
      await ctx.reply(`✅ Bio del bot actualizada:\n\n${truncatedBio}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.reply(`❌ No pude cambiar la bio.\n\n${errorMessage}`);
    }
  }
}
