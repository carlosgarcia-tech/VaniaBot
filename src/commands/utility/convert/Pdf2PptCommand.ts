/**
 * Pdf2PptCommand.ts
 *
 * utility command `pdf2ppt` — Convierte un PDF a PowerPoint (páginas como imágenes, no editable)
 * Usage: !pdf2ppt (responder a un archivo PDF)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage } from 'baileys';
import { ConversionService } from '@/services/convert/ConversionService.js';
import { TooManyPagesError } from '@/services/convert/PythonBridge.js';
import { extractDocumentMessage } from '@/services/convert/extractDocumentMessage.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!pdf2ppt`: Convierte un PDF a PowerPoint (páginas como imágenes, no editable). */
export class Pdf2PptCommand extends Command {
  name = 'pdf2ppt';
  description = 'Convierte un PDF a PowerPoint (páginas como imágenes, no editable)';
  category = CommandCategory.UTILITY;
  aliases = ['pdf2pptx', 'pdf2powerpoint', 'p2pp'];
  usage = '!pdf2ppt (responder a un archivo PDF)';
  examples = ['!pdf2ppt (responder a PDF)'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const messageToDownload = extractDocumentMessage(ctx);

    if (!messageToDownload) {
      await ctx.reply('❌ Responde a un archivo PDF con *!pdf2ppt* para convertirlo a PowerPoint.');
      return;
    }

    await ctx.react('⏳');

    try {
      const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
      const result = await ConversionService.getInstance().pdfToPpt(buffer);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        document: result.data,
        mimetype: result.mimeType,
        fileName: result.fileName,
        caption: '✅ PPTX generado (páginas como imágenes, no editable)',
      });

      await ctx.react('✅');
    } catch (error) {
      if (error instanceof TooManyPagesError) {
        await ctx.react('⚠️');
        await ctx.reply('⚠️ El PDF tiene demasiadas páginas para convertirlo.');
        return;
      }

      logError('[Pdf2PptCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al convertir el PDF a PowerPoint.');
    }
  }
}
