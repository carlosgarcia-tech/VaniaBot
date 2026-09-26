import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { TwitterDownloader } from '@/services/download/TwitterDownloader.js';
import { logger } from '@/utils/logger.js';
import { isRight } from '@/utils/either.js';
import { MediaPreviewBase, type PreviewInfo } from './MediaPreviewBase.js';

class TwitterPreview extends MediaPreviewBase {
  async send(ctx: MessageContext, info: PreviewInfo, status: string): Promise<void> {
    await this.sendPreview(
      ctx,
      info,
      {
        thumbnail: info.thumbnail,
        title: info.title,
        platform: 'twitter',
        author: info.author,
      },
      { header: '🐦 *Twitter/X*', extraLines: ['⬇️ descargando...'] },
      status,
    );
  }
}

export class TwitterCommand extends Command {
  name = 'twitter';
  description = 'Descarga videos de Twitter/X';
  category = CommandCategory.MEDIA;
  aliases = ['tw', 'xvideo', 'xv'];
  usage = '!twitter <url>';
  examples = [
    '!twitter https://twitter.com/user/status/123',
    '!twitter https://x.com/user/status/123',
  ];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private downloader = new TwitterDownloader();
  private preview = new TwitterPreview();

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args[0];

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *twitter downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:* !twitter <url>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!twitter https://twitter.com/user/status/123\n` +
          `  ﹒!twitter https://x.com/user/status/123`,
      );
      return;
    }

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply('❌ URL inválida. Proporciona un enlace de Twitter o X.');
      return;
    }

    await ctx.react('🔍');

    try {
      const infoResult = await this.downloader.getVideoInfo(url);
      const info = infoResult._tag === 'Right' ? infoResult.right : null;

      await this.preview.send(
        ctx,
        {
          title: info?.title || 'Twitter/X video',
          url,
          thumbnail: info?.thumbnailUrl,
          author: info?.author,
        },
        '> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕',
      );

      await ctx.react('⬇️');

      const result = await this.downloader.downloadVideo(url);

      if (!isRight(result)) {
        await ctx.reply(`❌ Error: ${result.left.message ?? 'No se pudo descargar'}`);
        return;
      }

      const downloadResult = result.right;

      try {
        // Stream from the file path: Baileys reads it in chunks, avoiding
        // loading the whole video into RAM.
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: { url: downloadResult.filePath },
          mimetype: 'video/mp4',
        });

        await ctx.react('✅');
      } finally {
        await this.downloader.cleanup(downloadResult.filePath);
      }
    } catch (error) {
      logger.error('Twitter command error:', error);
      await ctx.reply('❌ Error al descargar el video.');
    }
  }
}
