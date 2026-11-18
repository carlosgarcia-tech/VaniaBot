/**
 * ImgurCommand.ts
 *
 * media command `imgur` — Uploads a quoted/attached image to imgur and
 * replies with the link.
 *
 * Uses the official Imgur API (POST api.imgur.com/3/image) which requires a
 * free IMGUR_CLIENT_ID registered at api.imgur.com — the old Delirius
 * anonymous glue died. Without the key the command explains how to add it.
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { mediaMessageCache } from '@/services/media/MediaMessageCache.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const IMGUR_API = 'https://api.imgur.com/3/image';

/** Command handler for `!imgur`: Uploads an image to imgur. */
export class ImgurCommand extends Command {
  name = 'imgur';
  /** Uploads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  parallelizable = true;
  description = 'Sube una imagen a imgur y comparte el link';
  category = CommandCategory.MEDIA;
  aliases = ['imgur'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  usage = '!imgur (responde a una imagen)';
  examples = ['!imgur (respondiendo a una foto)'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const clientId = process.env.IMGUR_CLIENT_ID;
    if (!clientId) {
      await ctx.reply(
        '⚠️ Este comando necesita *IMGUR_CLIENT_ID* configurado en el servidor (gratis en api.imgur.com).',
      );
      return;
    }

    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const directImage = ctx.message.message?.imageMessage;

    if (!directImage && !quotedMsg?.imageMessage) {
      await ctx.reply('❌ Responde a una imagen para subirla a Imgur.');
      return;
    }

    await ctx.react('☁️');

    try {
      // Quoted stubs lack the CDN url — resolve the ORIGINAL cached message.
      const source: WAMessage =
        directImage || !quotedMsgId
          ? (ctx.message as WAMessage)
          : (mediaMessageCache.get(ctx.chat.jid, quotedMsgId) ??
            ({
              key: {
                id: quotedMsgId,
                remoteJid: ctx.quotedParticipant || ctx.chat.jid,
                fromMe: false,
              },
              message: { imageMessage: quotedMsg?.imageMessage },
              messageTimestamp: Date.now(),
              pushName: '',
              status: 0,
            } as WAMessage));

      const buffer = (await downloadMediaMessage(source, 'buffer', {})) as Buffer;

      const response = await fetch(IMGUR_API, {
        method: 'POST',
        headers: { Authorization: `Client-ID ${clientId}` },
        body: new Blob([new Uint8Array(buffer)]),
      });
      if (!response.ok) {
        throw new Error(`imgur error: ${response.status}`);
      }
      const data = (await response.json()) as {
        success?: boolean;
        data?: { link?: string };
      };
      if (!data.success || !data.data?.link) {
        throw new Error('imgur: sin link');
      }

      await ctx.reply(`☁️ *Imagen subida*\n\n🔗 ${data.data.link}`);
      await ctx.react('✅');
    } catch (error) {
      logError('[ImgurCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude subir la imagen. Intenta de nuevo.');
    }
  }
}
