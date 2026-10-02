/**
 * StickerCommand.ts
 *
 * media command `sticker` — Convert image/video to sticker
 * Usage: !sticker <reply to image/video>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { StickerHelper } from '@/utils/StickerHelper.js';

/** Command handler for `!sticker`: Convert image/video to sticker. */
export class StickerCommand extends Command {
  name = 'sticker';
  description = 'Convert image/video to sticker';
  category = CommandCategory.MEDIA;
  aliases = ['s'];
  usage = '!sticker <reply to image/video>';
  examples = ['!sticker', '!s'];
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const directMsg = ctx.message.message;

    const isQuoted = !!(quotedMsg?.imageMessage || quotedMsg?.videoMessage);
    const message = isQuoted ? quotedMsg : directMsg;

    if (!message || !(message.imageMessage || message.videoMessage)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito una imagen o video* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ responde a una foto/video con *!sticker*\n` +
          `✩ videos cortitos, menos de 10 segundos ✩`,
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
          videoMessage: message.videoMessage || undefined,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
      const stickerBuffer = await StickerHelper.createSticker(buffer);

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch (error) {
      logError('[StickerCommand] Error', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude convertir el sticker, intenta de nuevo.');
    }
  }
}
