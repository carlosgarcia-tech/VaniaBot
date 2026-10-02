/**
 * Pdf2DocxCommand.ts
 *
 * utility command `pdf2docx` — Convierte un PDF a Word (DOCX) editable
 * Usage: !pdf2docx (responder a un archivo PDF)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage } from 'baileys';
import { ConversionService } from '@/services/convert/ConversionService.js';
import { ScannedPdfError, TooManyPagesError } from '@/services/convert/PythonBridge.js';
import { extractDocumentMessage } from '@/services/convert/extractDocumentMessage.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!pdf2docx`: Convierte un PDF a Word (DOCX) editable. */
export class Pdf2DocxCommand extends Command {
  name = 'pdf2docx';
  description = 'Convierte un PDF a Word (DOCX) editable';
  category = CommandCategory.UTILITY;
  aliases = ['pdf2word', 'p2w'];
  usage = '!pdf2docx (responder a un archivo PDF)';
  examples = ['!pdf2docx (responder a PDF)'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const messageToDownload = extractDocumentMessage(ctx);

    if (!messageToDownload) {
      await ctx.reply('❌ Responde a un archivo PDF con *!pdf2docx* para convertirlo a Word.');
      return;
    }

    await ctx.react('⏳');

    try {
      const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
      const result = await ConversionService.getInstance().pdfToDocx(buffer);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        document: result.data,
        mimetype: result.mimeType,
        fileName: result.fileName,
        caption: '✅ Word generado desde PDF (funciona mejor con PDFs de texto simple)',
      });

      await ctx.react('✅');
    } catch (error) {
      if (error instanceof ScannedPdfError) {
        await ctx.react('⚠️');
        await ctx.reply(
          '⚠️ Este PDF parece escaneado (sin texto extraíble). No puedo convertirlo a Word editable.',
        );
        return;
      }

      if (error instanceof TooManyPagesError) {
        await ctx.react('⚠️');
        await ctx.reply('⚠️ El PDF tiene demasiadas páginas para convertirlo.');
        return;
      }

      logError('[Pdf2DocxCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al convertir el PDF a Word.');
    }
  }
}
