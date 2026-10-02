/**
 * ToAnimeCommand.ts
 *
 * media command `toanime` — Convertir imagen a estilo anime
 * Usage: !toanime (responde a imagen)
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import axios from 'axios';
import { env } from '@/config/env.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!toanime`: Convertir imagen a estilo anime. */
export class ToAnimeCommand extends Command {
  name = 'toanime';
  description = 'Convertir imagen a estilo anime';
  category = CommandCategory.MEDIA;
  aliases = ['toanime', 'toghibli'];
  usage = '!toanime (responde a imagen)';
  examples = ['!toanime'];
  cooldown = 30_000;

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;

    if (!quotedMsg || !quotedMsg.imageMessage) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta la imagen* ˚₊· ͟͟͞͞➳\n\n` + `✿ Responde a una *imagen* con *!toanime*`,
      );
      return;
    }

    const mime = quotedMsg.imageMessage.mimetype || '';
    if (!mime.startsWith('image/')) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *no es imagen* ˚₊· ͟͟͞͞➳\n\n` + `✿ Necesito que respondas a una *imagen*.`,
      );
      return;
    }

    if (!env.DEEPAI_API_KEY) {
      await ctx.reply(
        `❌ API KEY no establecida, esta función se encuentra temporalmente inhabilitada hasta que se agregue una api key funcional`,
      );
      return;
    }

    await ctx.react('⏳');
    await ctx.reply(`˚₊· ͟͟͞͞➳ *convirtiendo a anime...* ˚₊· ͟͟͞͞➳`);

    try {
      const messageToDownload: WAMessage = {
        key: {
          id: quotedMsgId || '',
          remoteJid: quotedParticipant || ctx.chat.jid,
          fromMe: false,
        },
        message: {
          imageMessage: quotedMsg.imageMessage,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const imageBuffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;

      const tempPath = `/tmp/toanime_${Date.now()}.jpg`;
      const fs = await import('fs');
      fs.writeFileSync(tempPath, imageBuffer);

      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('image', fs.createReadStream(tempPath));

      const response = await axios.postForm('https://api.deepai.org/api/toonify', formData, {
        headers: {
          'api-key': env.DEEPAI_API_KEY,
        },
        timeout: 60000,
      });

      fs.unlinkSync(tempPath);

      if (response.data?.output_url) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: response.data.output_url },
          caption: '˚₊· ͟͟͞͞➳ *listo* ˚₊· ͟͟͞͞➳',
        });
        await ctx.react('✅');
      } else {
        throw new Error('No se pudo obtener la imagen');
      }
    } catch (error: unknown) {
      logError('[ToAnimeCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` + `❌ No pude convertir la imagen. Intenta con otra.`,
      );
    }
  }
}
