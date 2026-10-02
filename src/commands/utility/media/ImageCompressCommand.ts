/**
 * ImageCompressCommand.ts
 *
 * utility command `imgcompress` — Comprime una imagen para reducir su tamaño.
 * Usage: !imgcompress [calidad 1-100 | tamañoMaxKB]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { ConverterService } from '@/services/media/ConverterService.js';
import { logError } from '@/utils/logger.js';

const converterService = new ConverterService();

/** Command handler for `!imgcompress`: Comprime una imagen para reducir su tamaño. */
export class ImageCompressCommand extends Command {
  name = 'imgcompress';
  description = 'Comprime una imagen para reducir su tamaño.';
  category = CommandCategory.UTILITY;
  aliases = ['imgcomp', 'icompress', 'comprimir'];
  usage = '!imgcompress [calidad 1-100 | tamañoMaxKB]';
  examples = ['!imgcompress', '!imgcompress 50', '!imgcompress 500'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const directMsg = ctx.message.message;

    const isQuoted = !!(quotedMsg?.imageMessage || quotedMsg?.stickerMessage);
    const message = isQuoted ? quotedMsg : directMsg;

    if (!message || !(message.imageMessage || message.stickerMessage)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *compresor de imágenes* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *uso:* !imgcompress [calidad | tamañoMaxKB]\n\n` +
          `  ﹒!imgcompress         → calidad 70\n` +
          `  ﹒!imgcompress 50      → calidad 50\n` +
          `  ﹒!imgcompress 500     → máximo 500 KB\n\n` +
          `✩ responde a una imagen o sticker ✩`,
      );
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
      const originalSizeKB = buffer.length / 1024;

      let quality = 70;
      let maxSizeKB: number | undefined;

      if (ctx.args.length > 0) {
        const arg = Number(ctx.args[0]);
        if (Number.isNaN(arg) || arg < 1) {
          await ctx.react('❌');
          await ctx.reply(
            '❌ El valor debe ser un número positivo (calidad 1-100 o tamaño máximo en KB).',
          );
          return;
        }
        if (arg > 100) {
          maxSizeKB = arg;
        } else {
          quality = Math.round(arg);
        }
      }

      const compressed = await converterService.compressImage(buffer, quality, maxSizeKB);
      const finalSizeKB = compressed.length / 1024;
      const reduction =
        originalSizeKB > 0 ? ((1 - finalSizeKB / originalSizeKB) * 100).toFixed(1) : '0.0';

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: compressed,
        caption:
          `📦 *Imagen comprimida*\n` +
          `━━━━━━━━━━━━━━\n` +
          `📐 Original: ${originalSizeKB.toFixed(1)} KB\n` +
          `📦 Final: ${finalSizeKB.toFixed(1)} KB\n` +
          `📉 Reducción: ${reduction}%`,
      });

      await ctx.react('✅');
    } catch (error) {
      logError('[ImageCompressCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al comprimir la imagen. Intenta de nuevo.');
    }
  }
}
