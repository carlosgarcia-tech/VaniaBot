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
/** Single source: package.json — `npm version minor` is all it takes. */
const BOT_VERSION = `𝚟${pkg.version}`;

/** Fecha del último arranque del bot (no por sticker). */
const _generatedOn = new Date().toLocaleDateString('es-MX', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const STICKER_BRANDING = {
  packname: `🪐 ${BOT_NAME} ꜱᴛɪᴄᴋᴇʀᴘᴀᴄᴋ`,

  author: [
    `✦ ᴄʀᴇᴀᴛᴏʀ & ᴅᴇᴠᴇʟᴏᴘᴇʀ`,
    CREATOR,
    `✦ ᴘʀᴏᴊᴇᴄᴛ: ${BOT_NAME}`,
    `✦ ᴠᴇʀꜱɪᴏɴ: ${BOT_VERSION}`,
    `✦ ᴘʀᴏᴄᴇꜱꜱᴇᴅ ᴡɪᴛʜ ${BOT_NAME}`,
    `© ${new Date().getFullYear()} ${BOT_NAME}`,
    `ᴛᴏᴅᴏꜱ ʟᴏꜱ ᴅᴇʀᴇᴄʜᴏꜱ ʀᴇꜱᴇʀᴠᴀᴅᴏꜱ`,
    `ᴅᴇꜱᴀʀʀᴏʟʟᴏ ʏ ᴍᴀɴᴛᴇɴɪᴍɪᴇɴᴛᴏ ᴘᴏʀ`,
    CREATOR,
    `ᴘʀᴏʜɪʙɪᴅᴀ ʟᴀ ᴅɪꜱᴛʀɪʙᴜᴄɪᴏɴ`,
    `ᴅᴇʟ ꜱᴏꜰᴛᴡᴀʀᴇ ᴏʀɪɢɪɴᴀʟ ꜱɪɴ ᴀᴜᴛᴏʀɪᴢᴀᴄɪᴏɴ`,
    `ɴᴏ ᴀꜰɪʟɪᴀᴅᴏ ᴀ ᴡʜᴀᴛꜱᴀᴘᴘ ɴɪ ᴍᴇᴛᴀ`,
    `✦ ɢʀᴀᴄɪᴀꜱ ᴘᴏʀ ᴜᴛɪʟɪᴢᴀʀ ${BOT_NAME} ✦`,
  ].join('\n'),
} as const;

/** Command handler for `!sticker`: Convert image/video to sticker. */
export class StickerCommand extends Command {
  name = 'sticker';
  description = 'Convert image/video to sticker';
  category = CommandCategory.MEDIA;
  aliases = ['s'];
  usage = '!sticker <reply to image/video>';
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

      // Branding: si falla el exif, se envía el sticker sin metadatos en vez de romper el comando
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
      await ctx.reply('❌ No pude convertir el sticker, intenta de nuevo.');
    }
  }
}
