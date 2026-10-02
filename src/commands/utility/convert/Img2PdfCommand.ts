/**
 * Img2PdfCommand.ts
 *
 * utility command `img2pdf` — Convierte una o más imágenes a PDF
 * Usage: !img2pdf (responder a una o más imágenes, o enviarlas y luego usar el comando)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage } from 'baileys';
import type { WAMessage } from 'baileys';
import { ConversionService } from '@/services/convert/ConversionService.js';
import { mediaGroupBuffer } from '@/core/MediaGroupBuffer.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!img2pdf`: Convierte una o más imágenes a PDF. */
export class Img2PdfCommand extends Command {
  name = 'img2pdf';
  description = 'Convierte una o más imágenes a PDF';
  category = CommandCategory.UTILITY;
  aliases = ['image2pdf', 'itoa'];
  usage = '!img2pdf (responder a una o más imágenes, o enviarlas y luego usar el comando)';
  examples = ['!img2pdf (responder a una imagen)', '!img2pdf (tras enviar varias fotos)'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const chatJid = ctx.chat.jid;
    const senderJid = ctx.sender.jid;

    if (quotedMsg?.imageMessage) {
      await ctx.react('⏳');
      await this.convertAndSend(ctx, [{ message: quotedMsg } as unknown as WAMessage]);
      return;
    }

    const directHasImage = !!ctx.message.message?.imageMessage;
    const bufferHasSomething = mediaGroupBuffer.hasAny(chatJid, senderJid);

    if (!directHasImage && !bufferHasSomething) {
      await ctx.reply(
        '❌ Responde a una imagen, o envía una o varias imágenes y luego usa *!img2pdf*.',
      );
      return;
    }

    await ctx.react('⏳');

    try {
      const buffered = await mediaGroupBuffer.waitAndConsume(chatJid, senderJid);

      if (directHasImage && !buffered.some(m => m.key.id === ctx.message.key.id)) {
        buffered.push(ctx.message);
      }

      if (buffered.length === 0) {
        await ctx.react('❌');
        return;
      }

      await this.convertAndSend(ctx, buffered);
    } catch (error) {
      logError('[Img2PdfCommand]', error);
      await ctx.react('❌');
    }
  }

  private async convertAndSend(ctx: MessageContext, messages: WAMessage[]): Promise<void> {
    try {
      const buffers: Buffer[] = [];
      for (const m of messages) {
        try {
          const buf = (await downloadMediaMessage(m, 'buffer', {})) as unknown as Buffer;
          buffers.push(buf);
        } catch (err) {
          logError('[Img2PdfCommand] Error descargando una imagen', err);
        }
      }

      if (buffers.length === 0) {
        await ctx.react('❌');
        return;
      }

      const result = await ConversionService.getInstance().imagesToPdf(buffers);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        document: result.data,
        mimetype: result.mimeType,
        fileName: result.fileName,
        caption: `✅ PDF generado (${buffers.length} imagen${buffers.length > 1 ? 'es' : ''})`,
      });

      await ctx.react('✅');
    } catch (error) {
      logError('[Img2PdfCommand]', error);
      await ctx.react('❌');
    }
  }
}
