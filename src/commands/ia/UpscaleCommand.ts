/**
 * UpscaleCommand.ts
 *
 * media command `upscale` — Mejora la resolución de una imagen
 * Usage: !upscale (responde a imagen/adjunto) o !upscale <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import axios from 'axios';

/** Command handler for `!upscale`: Mejora la resolución de una imagen. */
export class UpscaleCommand extends Command {
  name = 'upscale';
  description = 'Mejora la resolución de una imagen';
  category = CommandCategory.MEDIA;
  aliases = ['upscale', 'hd', 'enhanceimg'];
  usage = '!upscale (responde a imagen/adjunto) o !upscale <url>';
  examples = ['!upscale (reply a imagen)', '!upscale https://example.com/imagen.jpg'];
  cooldown = 60000;

  async execute(ctx: MessageContext): Promise<void> {
    const imageUrl = await this.getImageUrl(ctx);

    if (!imageUrl) {
      await ctx.reply(
        '✿ *!upscale* 〃\n\n' +
          '✩ Responde a una *imagen*\n' +
          '✩ O envíala junto al comando\n' +
          '✩ O usa una *URL*: !upscale <link>',
      );
      return;
    }

    await ctx.react('🖼️');
    await ctx.reply('🖼️ Mejorando resolución...');

    try {
      const data = (await deliriusService.getIa('upscale', { image: imageUrl })) as {
        result?: string;
        image?: string;
        url?: string;
      };

      const resultUrl = data?.result || data?.image || data?.url;

      if (resultUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: resultUrl },
          caption: '🖼️ *Upscale completado*',
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude upscalear la imagen. Intenta con otra.');
      }
    } catch (error) {
      logError('[UpscaleCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al upscalear la imagen. Intenta de nuevo.');
    }
  }

  private async getImageUrl(ctx: MessageContext): Promise<string | null> {
    if (ctx.args.length > 0) {
      const arg = ctx.args.join(' ');
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
        logError('[UpscaleCommand] getImageUrl (quoted)', error);
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
        logError('[UpscaleCommand] getImageUrl (message)', error);
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
