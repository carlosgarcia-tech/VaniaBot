/**
 * Pdf2ImgCommand.ts
 *
 * utility command `pdf2img` — Convierte un PDF a imágenes (jpg o png)
 * Usage: !pdf2img [jpg|png] (responder a un PDF)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { ConversionService } from '@/services/convert/ConversionService.js';
import type { ImageFormat } from '@/services/convert/types.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!pdf2img`: Convierte un PDF a imágenes (jpg o png). */
export class Pdf2ImgCommand extends Command {
  name = 'pdf2img';
  description = 'Convierte un PDF a imágenes (jpg o png)';
  category = CommandCategory.UTILITY;
  aliases = ['pdf2image', 'p2i'];
  usage = '!pdf2img [jpg|png] (responder a un PDF)';
  examples = ['!pdf2img (responder a PDF)', '!pdf2img png (responder a PDF)'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;
    const directMsg = ctx.message.message;

    const hasQuotedMedia = quotedMsg?.documentMessage;
    const hasDirectMedia = directMsg?.documentMessage;

    if (!hasQuotedMedia && !hasDirectMedia) {
      await ctx.reply('❌ Responde a un archivo PDF con *!pdf2img* para convertirlo a imágenes.');
      return;
    }

    const format: ImageFormat = ctx.args[0]?.toLowerCase() === 'png' ? 'png' : 'jpeg';
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
      const result = await ConversionService.getInstance().pdfToImages(buffer, format);

      const ext = format === 'png' ? 'png' : 'jpg';

      if (result.fileName.endsWith('.zip')) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          document: result.data,
          mimetype: result.mimeType,
          fileName: `paginas.${ext}.zip`,
          caption: '✅ Imágenes del PDF',
        });
      } else {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: result.data,
          caption: '✅ Página del PDF',
        });
      }

      await ctx.react('✅');
    } catch (error) {
      logError('[Pdf2ImgCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al convertir el PDF a imágenes.');
    }
  }
}
