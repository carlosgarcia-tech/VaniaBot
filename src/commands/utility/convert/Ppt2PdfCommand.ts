/**
 * Ppt2PdfCommand.ts
 *
 * utility command `ppt2pdf` — Convierte una presentación PPT/PPTX a PDF
 * Usage: !ppt2pdf (responder a un archivo PPT/PPTX)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { ConversionService } from '@/services/convert/ConversionService.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!ppt2pdf`: Convierte una presentación PPT/PPTX a PDF. */
export class Ppt2PdfCommand extends Command {
  name = 'ppt2pdf';
  description = 'Convierte una presentación PPT/PPTX a PDF';
  category = CommandCategory.UTILITY;
  aliases = ['powerpoint2pdf', 'pptx2pdf', 'p2p'];
  usage = '!ppt2pdf (responder a un archivo PPT/PPTX)';
  examples = ['!ppt2pdf (responder a PPT)'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;
    const directMsg = ctx.message.message;

    const hasQuotedMedia = quotedMsg?.documentMessage;
    const hasDirectMedia = directMsg?.documentMessage;

    if (!hasQuotedMedia && !hasDirectMedia) {
      await ctx.reply('❌ Responde a un archivo PPT/PPTX con *!ppt2pdf* para convertirlo.');
      return;
    }

    await ctx.react('⏳');

    try {
      let messageToDownload: WAMessage;

      if (hasQuotedMedia && quotedMsg) {
        messageToDownload = {
          key: {
            id: quotedMsgId || '',
            remoteJid: quotedParticipant || ctx.chat.jid,
            fromMe: false,
          },
          message: {
            documentMessage: quotedMsg.documentMessage,
          },
          messageTimestamp: Date.now(),
          pushName: '',
          status: 0,
        };
      } else if (hasDirectMedia) {
        messageToDownload = {
          key: {
            id: ctx.message.key?.id || '',
            remoteJid: ctx.message.key?.remoteJid || ctx.chat.jid,
            fromMe: ctx.message.key?.fromMe || false,
          },
          message: {
            documentMessage: directMsg.documentMessage,
          },
          messageTimestamp: Date.now(),
          pushName: '',
          status: 0,
        };
      } else {
        await ctx.reply('❌ No se encontró ningún documento para convertir.');
        return;
      }

      const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
      const result = await ConversionService.getInstance().pptToPdf(buffer);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        document: result.data,
        mimetype: result.mimeType,
        fileName: result.fileName,
        caption: '✅ PDF generado desde PPT',
      });

      await ctx.react('✅');
    } catch (error) {
      logError('[Ppt2PdfCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al convertir PPT a PDF.');
    }
  }
}
