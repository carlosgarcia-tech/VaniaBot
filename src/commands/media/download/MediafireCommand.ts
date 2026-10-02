/**
 * MediafireCommand.ts
 *
 * media command `mediafire` — Descarga archivos de Mediafire
 * Usage: !mf <url de mediafire>
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview MediafireCommand.ts - Download from Mediafire
 *
 * Downloads files from Mediafire.
 *
 * @module commands/media/download/MediafireCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { mediafireDownloader } from '@/services/download/MediafireDownloader.js';
import { isRight } from '@/utils/either.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!mediafire`: Descarga archivos de Mediafire. */
export class MediafireCommand extends Command {
  name = 'mediafire';
  description = 'Descarga archivos de Mediafire';
  category = CommandCategory.MEDIA;
  aliases = ['mf', 'mediafiledl'];
  usage = '!mf <url de mediafire>';
  examples = ['!mf https://www.mediafire.com/file/...'];
  cooldown = 300000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args.join(' ').trim();

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Mediafire Downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!mf <url de mediafire>\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!mf https://www.mediafire.com/file/abc123`,
      );
      return;
    }

    if (!url.includes('mediafire')) {
      await ctx.reply('❌ La URL debe ser de Mediafire');
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Obteniendo info de Mediafire...`);

    try {
      const infoResult = await mediafireDownloader.getInfo(url);

      if (!isRight(infoResult)) {
        await ctx.react('❌');
        await ctx.reply(`❌ ${infoResult.left.message || 'No se pudo obtener info del archivo'}`);
        return;
      }

      const info = infoResult.right;
      await ctx.reply(`📥 Descargando: ${info.filename}...`);

      const result = await mediafireDownloader.download(url);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(
          `❌ ${result.left.message || 'Error al descargar'}\n\n🔗 Enlace directo:\n${info.url}`,
        );
        return;
      }

      const downloadResult = result.right;
      const isVideo = /\.(mp4|mkv|avi|mov)$/i.test(downloadResult.filename || '');
      const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(downloadResult.filename || '');

      if (isVideo) {
        const caption = `📁 *${downloadResult.filename}*\n💾 ${downloadResult.size || 'Desconocido'}\n📦 Mediafire`;
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            video: { url: downloadResult.filePath },
            caption: caption,
          },
          { quoted: ctx.message },
        );
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
            fileName: downloadResult.filename,
            caption: `📁 *${downloadResult.filename}*\n💾 ${downloadResult.size || 'Desconocido'}\n📦 Mediafire`,
          },
          { quoted: ctx.message },
        );
      }

      mediafireDownloader.cleanup(downloadResult.filePath);
      await ctx.react('✅');
    } catch (error) {
      logError('MediafireCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Mediafire');
    }
  }
}
