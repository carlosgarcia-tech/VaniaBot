/**
 * MailmessagesCommand.ts
 *
 * media command `mailmessages` — Verifica los mensajes de un email temporal
 * Usage: !mailmessages <email>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';

/** Command handler for `!mailmessages`: Verifica los mensajes de un email temporal. */
export class MailmessagesCommand extends Command {
  name = 'mailmessages';
  description = 'Verifica los mensajes de un email temporal';
  category = CommandCategory.MEDIA;
  aliases = ['mailmessages', 'inbox', 'checkmail'];
  usage = '!mailmessages <email>';
  examples = ['!mailmessages m.a.r.ion.a.no.nuevo71@googlemail.com'];
  cooldown = 15000;

  async execute(ctx: MessageContext): Promise<void> {
    const email = ctx.args?.join(' ').trim();

    if (!email) {
      await ctx.reply(
        '✿ *!mailmessages* 〃\n\n' +
          '✩ Uso: !mailmessages <email>\n' +
          '✩ Ejemplo: !mailmessages tu@email.com\n\n' +
          '💡 Primero crea un email con *!mailcreate*',
      );
      return;
    }

    if (!email.includes('@')) {
      await ctx.reply('❌ Debes proporcionar un email válido');
      return;
    }

    await ctx.react('📬');
    await ctx.reply('📬 Verificando mensajes...');

    try {
      const data = (await deliriusService.getIa('mailmessages', { query: email })) as {
        result?: string;
        messages?: Array<{
          from?: string;
          subject?: string;
          body?: string;
          date?: string;
        }>;
      };

      if (data?.messages && data.messages.length > 0) {
        let response = `📬 *Mensajes para:* ${email}\n\n`;
        for (const msg of data.messages.slice(0, 5)) {
          response += `📧 *De:* ${msg.from || 'Desconocido'}\n`;
          response += `📝 *Asunto:* ${msg.subject || 'Sin asunto'}\n`;
          response += `📅 *Fecha:* ${msg.date || 'N/A'}\n`;
          if (msg.body) {
            const bodyPreview = msg.body.substring(0, 100);
            response += `💬 ${bodyPreview}${msg.body.length > 100 ? '...' : ''}\n`;
          }
          response += '────────────────────\n';
        }

        if (data.messages.length > 5) {
          response += `\n... y ${data.messages.length - 5} más`;
        }

        await ctx.reply(response);
        await ctx.react('✅');
      } else if (data?.result) {
        await ctx.reply(data.result);
      } else {
        await ctx.reply('📭 No hay mensajes nuevos para este email.');
      }
    } catch (error) {
      logError('[MailmessagesCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al verificar mensajes. Intenta de nuevo.');
    }
  }
}
