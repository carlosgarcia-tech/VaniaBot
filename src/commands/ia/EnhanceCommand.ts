/**
 * EnhanceCommand.ts
 *
 * media command `enhance` — Mejora y enlarge una imagen con IA
 * Usage: !enhance (responde a imagen) [scale] o !enhance <url> [scale]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import axios from 'axios';

/** Command handler for `!enhance`: Mejora y enlarge una imagen con IA. */
export class EnhanceCommand extends Command {
  name = 'enhance';
  description = 'Mejora y enlarge una imagen con IA';
  category = CommandCategory.MEDIA;
  aliases = ['enhance', 'mejora'];
  usage = '!enhance (responde a imagen) [scale] o !enhance <url> [scale]';
  examples = [
    '!enhance (reply a imagen)',
    '!enhance https://example.com/imagen.jpg',
    '!enhance (reply) 4',
  ];
  cooldown = 60000;

  async execute(ctx: MessageContext): Promise<void> {
    const imageUrl = await this.getImageUrl(ctx);

    if (!imageUrl) {
      await ctx.reply(
        '✿ *!enhance* 〃\n\n' +
          '✩ Responde a una *imagen*\n' +
          '✩ O envíala junto al comando\n' +
          '✩ O usa una *URL*: !enhance <link>\n' +
          '✩ Scale opcional: 2, 4, 8 (default: 4)',
      );
      return;
    }

    let scale = 4;
    const lastArg = ctx.args[ctx.args.length - 1];
    if (/^[248]$/.test(lastArg)) {
      scale = parseInt(lastArg, 10);
    }

    await ctx.react('✨');
    await ctx.reply(`✨ Mejorando imagen (${scale}x)...`);

    try {
      const data = (await deliriusService.getIa('enhance', {
        image: imageUrl,
        scale: scale.toString(),
      })) as {
        result?: string;
        image?: string;
        url?: string;
      };

      const resultUrl = data?.result || data?.image || data?.url;

      if (resultUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: resultUrl },
          caption: `✨ *Enhance completado (${scale}x)*`,
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude mejorar la imagen. Intenta con otra.');
      }
    } catch (error) {
      logError('[EnhanceCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al mejorar la imagen. Intenta de nuevo.');
    }
  }

  private async getImageUrl(ctx: MessageContext): Promise<string | null> {
    const argsWithoutLast = ctx.args.slice(0, -1);
    const lastArg = ctx.args[ctx.args.length - 1];

    if (ctx.args.length > 0) {
      const arg =
        lastArg && /^[248]$/.test(lastArg) ? argsWithoutLast.join(' ') : ctx.args.join(' ');

      if (arg.startsWith('http://') || arg.startsWith('https://')) {
        return arg;
      }
    }

    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;

    if (quotedMsg?.imageMessage && quotedMsgId) {
      try {
        const messageToDownload: WAMessage = {
          key: {
            id: quotedMsgId,
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
        const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
        const uploaded = await this.uploadToImgbb(buffer);
        return uploaded;
      } catch (error) {
        logError('[EnhanceCommand] getImageUrl (quoted)', error);
        return null;
      }
    }

    if (ctx.message.message?.imageMessage) {
      try {
        const messageToDownload: WAMessage = {
          key: {
            id: ctx.message.key?.id || '',
            remoteJid: ctx.message.key?.remoteJid || ctx.chat.jid,
            fromMe: ctx.message.key?.fromMe || false,
          },
          message: {
            imageMessage: ctx.message.message.imageMessage,
          },
          messageTimestamp: Date.now(),
          pushName: '',
          status: 0,
        };
        const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
        const uploaded = await this.uploadToImgbb(buffer);
        return uploaded;
      } catch (error) {
        logError('[EnhanceCommand] getImageUrl (message)', error);
        return null;
      }
    }

    return null;
  }

  private async uploadToImgbb(buffer: Buffer): Promise<string> {
    const base64 = buffer.toString('base64');
    const response = await axios.postForm('https://api.imgbb.com/1/upload', undefined, {
      params: {
        key: '0d6218137c2e7c64d7c8f3b10a28c8b6',
        image: base64,
      },
    });
    return response.data.data.url;
  }
}
