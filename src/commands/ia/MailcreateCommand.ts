/**
 * MailcreateCommand.ts
 *
 * media command `mailcreate` — Crea un email temporal
 * Usage: !mailcreate
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';

/** Command handler for `!mailcreate`: Crea un email temporal. */
export class MailcreateCommand extends Command {
  name = 'mailcreate';
  description = 'Crea un email temporal';
  category = CommandCategory.MEDIA;
  aliases = ['mailcreate', 'tempemail', 'emailtemp'];
  usage = '!mailcreate';
  examples = ['!mailcreate'];
  cooldown = 15000;

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📧');
    await ctx.reply('📧 Creando email temporal...');

    try {
      const data = (await deliriusService.getIa('mailcreate')) as {
        result?: string;
        email?: string;
        address?: string;
      };

      const email = data?.result || data?.email || data?.address;

      if (email) {
        await ctx.reply(
          `📧 *Email temporal creado* ✉️\n\n` +
            `✩ *Email:* ${email}\n\n` +
            `⏰ Este email es temporal.\n` +
            `💬 Usa *!mailmessages ${email}* para ver los mensajes.`,
        );
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude crear el email. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[MailcreateCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al crear email. Intenta de nuevo.');
    }
  }
}
