/**
 * ImageConvertCommand.ts
 *
 * utility command `imgconvert` — Convierte una imagen a otro formato (jpeg, png, webp, gif, bmp, tiff).
 * Usage: !imgconvert <formato> [calidad 1-100]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import {
  ConverterService,
  normalizeFormat,
  getFormatMime,
  getFormatExt,
  type ImageFormat,
} from '@/services/media/ConverterService.js';
import { logError } from '@/utils/logger.js';

const converterService = new ConverterService();

/** Command handler for `!imgconvert`: Convierte una imagen a otro formato (jpeg, png, webp, gif, bmp, tiff). */
export class ImageConvertCommand extends Command {
  name = 'imgconvert';
  description = 'Convierte una imagen a otro formato (jpeg, png, webp, gif, bmp, tiff).';
  category = CommandCategory.UTILITY;
  aliases = ['imgto', 'iconvert'];
  usage = '!imgconvert <formato> [calidad 1-100]';
  examples = ['!imgconvert png', '!imgconvert webp 80', '!imgconvert jpg', '!imgconvert gif'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *conversor de imágenes* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *uso:* !imgconvert <formato> [calidad]\n\n` +
          `✩ *formatos:* jpeg, png, webp, gif, bmp, tiff\n` +
          `  ﹒!imgconvert png\n` +
          `  ﹒!imgconvert webp 80\n\n` +
          `✩ responde a una imagen o sticker ✩`,
      );
      return;
    }

    let format: ImageFormat;
    try {
      format = normalizeFormat(ctx.args[0]);
    } catch {
      await ctx.reply('❌ Formato no soportado. Usa: jpeg, png, webp, gif, bmp, tiff');
      return;
    }

    const quality = ctx.args[1] ? this.parseQuality(ctx.args[1]) : undefined;
    if (ctx.args[1] && quality === undefined) {
      await ctx.reply('❌ La calidad debe ser un número entre 1 y 100.');
      return;
    }

    const quotedMsg = ctx.quoted;
    const directMsg = ctx.message.message;

    const isQuoted = !!(quotedMsg?.imageMessage || quotedMsg?.stickerMessage);
    const message = isQuoted ? quotedMsg : directMsg;

    if (!message || !(message.imageMessage || message.stickerMessage)) {
      await ctx.reply('❌ Responde a una imagen o sticker con !imgconvert <formato>');
      return;
    }

    await ctx.react('⏳');

    try {
      const msgId = isQuoted ? ctx.quotedMessageId : ctx.message.key?.id;
      const remoteJid = isQuoted
        ? ctx.quotedParticipant || ctx.chat.jid
        : ctx.message.key?.remoteJid || ctx.chat.jid;

      const messageToDownload: WAMessage = {
        key: {
          id: msgId || '',
          remoteJid: remoteJid,
          fromMe: isQuoted ? false : ctx.message.key?.fromMe || false,
        },
        message: {
          imageMessage: message.imageMessage || undefined,
          stickerMessage: message.stickerMessage || undefined,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
      const originalSizeKB = (buffer.length / 1024).toFixed(1);

      const result = await converterService.convertImage(
        buffer,
        format,
        quality ? { quality } : undefined,
      );
      const finalSizeKB = (result.length / 1024).toFixed(1);

      const mime = getFormatMime(format);
      const ext = getFormatExt(format);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        document: result,
        mimetype: mime,
        fileName: `imgconvert_${Date.now()}.${ext}`,
        caption:
          `🖼️ *Imagen convertida*\n` +
          `━━━━━━━━━━━━━━\n` +
          `🔄 Formato: \`.${ext}\`\n` +
          `📐 Original: ${originalSizeKB} KB\n` +
          `📦 Final: ${finalSizeKB} KB`,
      });

      await ctx.react('✅');
    } catch (error) {
      logError('[ImageConvertCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al convertir la imagen. Intenta de nuevo.');
    }
  }

  private parseQuality(value: string): number | undefined {
    const n = Number(value);
    if (Number.isNaN(n) || n < 1 || n > 100) return undefined;
    return Math.round(n);
  }
}
