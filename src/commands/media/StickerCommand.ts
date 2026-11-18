/**
 * StickerCommand.ts
 *
 * media command `sticker` — Convert image/video to sticker
 * Usage: !sticker <reply to image/video>
 *
 * Every sticker is branded with pack metadata (pack name + author/copyright)
 * via StickerService.addExif. Edit STICKER_BRANDING below to change the text.
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { StickerService } from '@/services/media/StickerService.js';
import { mediaMessageCache } from '@/services/media/MediaMessageCache.js';
import pkg from '../../../package.json' with { type: 'json' };

/**
 * Pack metadata shown in WhatsApp's "sticker info" screen.
 *
 * WhatsApp shows `packname` as the title and `author` as the publisher line.
 * Keep the FIRST line of each field short: long text gets cut with "..." in
 * the sticker tray, and only the full info screen shows everything.
 *
 * If multi-line looks off on your WhatsApp version, replace "\n" with " · ".
 */
const BOT_NAME = 'ᴏʀʙɪᴛʙᴏᴛ';
const CREATOR = 'ɪɴɢ. ᴄᴀʀʟᴏꜱ ɢᴀʀᴄɪᴀ';
const BOT_VERSION = `𝚟${pkg.version}`;
const REPO_URL = 'https://github.com/carlosgarcia-tech/VaniaBot';

const STICKER_BRANDING = {
  packname: `👑 ${BOT_NAME} ꜱᴛɪᴄᴋᴇʀꜱ`,

  author: [
    `✦ ᴇʟ ʙᴏᴛ ᴍᴀꜱ ɢʀᴀɴᴅᴇ ᴅᴇ ᴡʜᴀᴛꜱᴀᴘᴘ`,
    `✦ ᴍɪ ᴄʀᴇᴀᴅᴏʀ (ʟᴏ ʜɪᴢᴏ ʙɪᴇɴ):`,
    CREATOR,
    `✦ ᴏᴘᴇɴ ꜱᴏᴜʀᴄᴇ: ᴘᴇʀꜰᴇᴄᴄɪᴏɴ ᴘᴀʀᴀ ᴇꜱᴛᴜᴅɪᴀʀ · ${BOT_VERSION}`,
    REPO_URL ? `✦ ${REPO_URL}` : '',
    `✦ ᴛᴜ ꜱᴛɪᴄᴋᴇʀ, ᴍɪ ᴛᴀʟᴇɴᴛᴏ`,
    `ɴᴏ ᴀꜰɪʟɪᴀᴅᴏ ᴀ ᴡʜᴀᴛꜱᴀᴘᴘ ɴɪ ᴍᴇᴛᴀ · ᴅᴇᴍᴀꜱɪᴀᴅᴏ ɢʀᴀɴᴅᴇ ᴘᴀʀᴀ ᴇʟʟᴏꜱ`,
  ]
    .filter(Boolean)
    .join('\n'),
} as const;

/** Command handler for `!sticker`: Convert image/video to sticker. */
export class StickerCommand extends Command {
  name = 'sticker';
  description = 'Convert image/video to sticker';
  category = CommandCategory.MEDIA;
  aliases = ['s'];
  usage = '!sticker <reply to image/video>';
  timeout = 60_000;
  examples = ['!sticker', '!s'];
  contexts = [CommandContext.BOTH];

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const directMsg = ctx.message.message;

    const isQuoted = !!(quotedMsg?.imageMessage || quotedMsg?.videoMessage);
    const message = isQuoted ? quotedMsg : directMsg;

    if (!message || !(message.imageMessage || message.videoMessage)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito una imagen o video* ˚₊· ͟͟͞͞➳\n\n` +
          `✦ responde a una foto/video con *!sticker*\n` +
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

      let messageToDownload: WAMessage | undefined;
      if (isQuoted && msgId) {
        messageToDownload = mediaMessageCache.get(ctx.chat.jid, msgId);
      }

      if (!messageToDownload) {
        messageToDownload = {
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
      }

      const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;
      const stickerBuffer = await StickerHelper.createSticker(buffer);

      let finalSticker: Buffer = stickerBuffer;
      try {
        finalSticker = await this.stickerService.addExif(
          stickerBuffer,
          STICKER_BRANDING.packname,
          STICKER_BRANDING.author,
        );
      } catch (exifError) {
        logError('[StickerCommand] addExif falló, enviando sin metadatos', exifError);
      }

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: finalSticker });
      await ctx.react('✅');
    } catch (error) {
      logError('[StickerCommand] Error', error);
      await ctx.react('❌');
      await ctx.reply(describeStickerError(error));
    }
  }
}

/** Turns opaque conversion errors into a reply that names the actual cause. */
function describeStickerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('timed out')) {
    return '⏱️ El video es demasiado largo para convertirlo a tiempo. Intenta con uno de menos de 10 segundos.';
  }
  if (message.startsWith('FFmpeg video failed:')) {
    const reason = message.slice('FFmpeg video failed:'.length).trim().slice(0, 140);
    return `❌ No pude convertir el video a sticker. ffmpeg: ${reason || 'error desconocido'}`;
  }
  if (message.startsWith('FFmpeg failed:')) {
    const reason = message.slice('FFmpeg failed:'.length).trim().slice(0, 140);
    return `❌ No pude convertir la imagen a sticker. ffmpeg: ${reason || 'error desconocido'}`;
  }
  if (/download|ENOENT|aborted/i.test(message)) {
    return '❌ No pude descargar el media. Intenta reenviarlo y volver a responder con !sticker.';
  }
  return `❌ No pude convertir el sticker: ${message.slice(0, 140)}`;
}
