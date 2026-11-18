/**
 * MailcreateCommand.ts
 *
 * media command `mailcreate` — Creates a temporary email
 * Usage: !mailcreate
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { mailService } from '@/services/external/MailService.js';
import { logError } from '@/utils/logger.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';

/** Command handler for `!mailcreate`: Creates a temporary email. */
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
      // mail.tm (gratuito, verificado en vivo). La cuenta persiste en
      // data/temp/mail-accounts.json para que !mailmessages pueda re-loguear.
      const account = await mailService.createAccount();
      await ctx.reply(
        `📧 *Email temporal creado* ✉️\n\n` +
          `✩ *Email:* ${account.address}\n\n` +
          `⏰ Este email es temporal.\n` +
          `💬 Usa *!mailmessages ${account.address}* para ver los mensajes.`,
      );
      await ctx.react('✅');
    } catch (error) {
      logError('[MailcreateCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al crear email. Intenta de nuevo.');
    }
  }
}
