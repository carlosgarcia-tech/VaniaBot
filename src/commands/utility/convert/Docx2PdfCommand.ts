/**
 * Docx2PdfCommand.ts
 *
 * utility command `docx2pdf` — Convierte un documento DOC/DOCX a PDF
 * Usage: !docx2pdf (responder a un archivo DOC/DOCX)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { ConversionService } from '@/services/convert/ConversionService.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!docx2pdf`: Convierte un documento DOC/DOCX a PDF. */
export class Docx2PdfCommand extends Command {
  name = 'docx2pdf';
  description = 'Convierte un documento DOC/DOCX a PDF';
  category = CommandCategory.UTILITY;
  aliases = ['word2pdf', 'doc2pdf', 'd2p'];
  usage = '!docx2pdf (responder a un archivo DOC/DOCX)';
  examples = ['!docx2pdf (responder a DOCX)'];
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
      await ctx.reply('❌ Responde a un archivo DOC/DOCX con *!docx2pdf* para convertirlo.');
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
      const result = await ConversionService.getInstance().docxToPdf(buffer);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        document: result.data,
        mimetype: result.mimeType,
        fileName: result.fileName,
        caption: '✅ PDF generado desde DOCX',
      });

      await ctx.react('✅');
    } catch (error) {
      logError('[Docx2PdfCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al convertir DOCX a PDF.');
    }
  }
}
