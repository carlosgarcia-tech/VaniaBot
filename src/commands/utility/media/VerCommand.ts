import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { logger } from '@/utils/logger.js';

export class VerCommand extends Command {
  name = 'ver';
  description = 'Envía una imagen del chat como imagen normal';
  category = CommandCategory.UTILITY;
  aliases = ['img', 'verimagen', 'image', 'reenviar'];
  usage = '!ver (responder a una imagen)';
  examples = ['!ver (responder a una imagen)'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;

    if (!quotedMsg || !quotedMsgId) {
      await ctx.reply(
        `❌ Debes *responder* a una imagen para reenviarla.\n\n` +
          `Usa el comando respondiendo a una imagen que ya se haya enviado en el chat.`,
      );
      return;
    }

    const imageMsg = quotedMsg.imageMessage || quotedMsg.videoMessage;

    if (!imageMsg) {
      await ctx.reply('❌ El mensaje citado no es una imagen.');
      return;
    }

    await ctx.react('⏳');

    try {
      const messageToDownload: WAMessage = {
        key: {
          id: quotedMsgId,
          remoteJid: ctx.chat.jid,
          fromMe: false,
        },
        message: {
          imageMessage: imageMsg,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const mediaBuffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;

      const caption = imageMsg.caption || '🖼️ Imagen';

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: mediaBuffer,
        caption,
      });

      await ctx.react('✅');
    } catch (error) {
      logger.error('[VerCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ No se pudo reenviar la imagen.');
    }
  }
}
