/**
 * MegaCommand.ts
 *
 * media command `mega` — Descarga archivos de Mega.nz
 * Usage: !mega <url de mega>
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview MegaCommand.ts - Download from Mega.nz
 *
 * Downloads files from Mega.nz using megajs.
 *
 * @module commands/media/download/MegaCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { megaDownloader } from '@/services/download/MegaDownloader.js';
import { isRight } from '@/utils/either.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!mega`: Descarga archivos de Mega.nz. */
export class MegaCommand extends Command {
  name = 'mega';
  description = 'Descarga archivos de Mega.nz';
  category = CommandCategory.MEDIA;
  aliases = ['megadl'];
  usage = '!mega <url de mega>';
  examples = ['!mega https://mega.nz/file/...'];
  cooldown = 300000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args.join(' ').trim();

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Mega Downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!mega <url de mega>\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!mega https://mega.nz/file/abc123`,
      );
      return;
    }

    if (!url.includes('mega')) {
      await ctx.reply('❌ La URL debe ser de Mega.nz');
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Obteniendo info de Mega...`);

    try {
      const infoResult = await megaDownloader.getInfo(url);

      if (!isRight(infoResult)) {
        await ctx.react('❌');
        await ctx.reply('❌ No se pudo obtener info del archivo');
        return;
      }

      const info = infoResult.right;
      await ctx.reply(`📥 Descargando: ${info.name}...`);

      const result = await megaDownloader.download(url);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.left.message || 'Error al descargar'}`);
        return;
      }

      const downloadResult = result.right;
      const isVideo = /\.(mp4|mkv|avi|mov)$/i.test(downloadResult.name || '');
      const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(downloadResult.name || '');
      const sizeMB = ((downloadResult.size || 0) / (1024 * 1024)).toFixed(2);

      if (isVideo) {
        const caption = `📁 *${downloadResult.name}*\n💾 ${sizeMB} MB\n📦 Mega.nz`;
        if ((downloadResult.size || 0) > 60 * 1024 * 1024) {
          await ctx.sock.sendMessage(
            ctx.chat.jid,
            {
              document: { url: downloadResult.filePath },
              mimetype: 'video/mp4',
              fileName: downloadResult.name,
              caption: caption,
            },
            { quoted: ctx.message },
          );
        } else {
          await ctx.sock.sendMessage(
            ctx.chat.jid,
            {
              video: { url: downloadResult.filePath },
              caption: caption,
            },
            { quoted: ctx.message },
          );
        }
      } else if (isAudio) {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            audio: { url: downloadResult.filePath },
            mimetype: 'audio/mpeg',
            ptt: false,
          },
          { quoted: ctx.message },
        );
      } else {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            document: { url: downloadResult.filePath },
            mimetype: 'application/octet-stream',
            fileName: downloadResult.name,
            caption: `📁 *${downloadResult.name}*\n💾 ${sizeMB} MB\n📦 Mega.nz`,
          },
          { quoted: ctx.message },
        );
      }

      megaDownloader.cleanup(downloadResult.filePath);
      await ctx.react('✅');
    } catch (error) {
      logError('MegaCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Mega.nz');
    }
  }
}
